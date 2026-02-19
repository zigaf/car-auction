import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { Bid } from '../../db/entities/bid.entity';
import { Lot } from '../../db/entities/lot.entity';
import { BalanceTransaction } from '../../db/entities/balance-transaction.entity';
import { LotStatus } from '../../common/enums/lot-status.enum';

/** Anti-sniping: if a bid arrives in the last N milliseconds, extend the auction */
const ANTI_SNIPE_WINDOW_MS = 30 * 1000; // 30 seconds
const ANTI_SNIPE_EXTENSION_MS = 2 * 60 * 1000; // 2 minutes

export interface PlaceBidResult {
  bid: Bid;
  auctionExtended: boolean;
  newEndAt: Date | null;
}

@Injectable()
export class AuctionService {
  constructor(
    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,
    @InjectRepository(Lot)
    private readonly lotRepository: Repository<Lot>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Place a bid on a lot.
   * Uses a DB transaction with row-level locking (SELECT ... FOR UPDATE)
   * to prevent race conditions.
   */
  async placeBid(
    userId: string,
    lotId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<PlaceBidResult> {
    // Check idempotency first (outside transaction for fast rejection)
    const existingBid = await this.bidRepository.findOne({
      where: { idempotencyKey },
    });
    if (existingBid) {
      return { bid: existingBid, auctionExtended: false, newEndAt: null };
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock the lot row to prevent concurrent bid race conditions
      const lot = await manager
        .createQueryBuilder(Lot, 'lot')
        .setLock('pessimistic_write')
        .where('lot.id = :lotId', { lotId })
        .getOne();

      if (!lot) {
        throw new NotFoundException('Lot not found');
      }

      if (lot.status !== LotStatus.TRADING) {
        throw new BadRequestException('Lot is not currently in trading');
      }

      // Prevent self-bidding
      if (userId === lot.createdBy) {
        throw new ForbiddenException('Cannot bid on your own lot');
      }

      // Check auction hasn't ended
      if (lot.auctionEndAt && new Date() > lot.auctionEndAt) {
        throw new BadRequestException('Auction has ended');
      }

      // Check bid amount meets minimum requirement
      const currentPrice = lot.currentPrice
        ? parseFloat(String(lot.currentPrice))
        : lot.startingBid
          ? parseFloat(String(lot.startingBid))
          : 0;
      const bidStep = parseFloat(String(lot.bidStep)) || 100;
      const minimumBid = currentPrice + bidStep;

      if (amount < minimumBid) {
        throw new BadRequestException(
          `Bid too low. Minimum bid is ${minimumBid} (current price ${currentPrice} + step ${bidStep})`,
        );
      }

      // Check user balance INSIDE the transaction with row-level locking
      const balanceResult = await manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .setLock('pessimistic_write')
        .select('COALESCE(SUM(tx.amount), 0)', 'balance')
        .where('tx.user_id = :userId', { userId })
        .getRawOne();

      const balance = parseFloat(balanceResult?.balance || '0');
      if (balance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Double-check idempotency inside transaction
      const duplicateBid = await manager.findOne(Bid, {
        where: { idempotencyKey },
      });
      if (duplicateBid) {
        return { bid: duplicateBid, auctionExtended: false, newEndAt: null };
      }

      // Create bid record
      const bid = manager.create(Bid, {
        lotId,
        userId,
        amount,
        idempotencyKey,
        isPreBid: false,
        maxAutoBid: null,
      });
      const savedBid = await manager.save(Bid, bid);

      // Update lot current price
      lot.currentPrice = amount;

      // Anti-sniping: extend auction if bid placed within last 30 seconds
      let auctionExtended = false;
      let newEndAt: Date | null = null;

      if (lot.auctionEndAt) {
        const timeUntilEnd = lot.auctionEndAt.getTime() - Date.now();
        if (timeUntilEnd > 0 && timeUntilEnd <= ANTI_SNIPE_WINDOW_MS) {
          const extendedEnd = new Date(Date.now() + ANTI_SNIPE_EXTENSION_MS);
          lot.auctionEndAt = extendedEnd;
          auctionExtended = true;
          newEndAt = extendedEnd;
        }
      }

      await manager.save(Lot, lot);

      // Reload bid with lot relation only (no user relation to avoid data exposure)
      const fullBid = await manager.findOne(Bid, {
        where: { id: savedBid.id },
        relations: ['lot'],
      });

      return {
        bid: fullBid || savedBid,
        auctionExtended,
        newEndAt,
      };
    });
  }

  /**
   * Buy Now: Instantly purchase a lot at the buy-now price.
   * Sets the lot status to SOLD and records the winner.
   */
  async buyNow(
    userId: string,
    lotId: string,
  ): Promise<{ bid: Bid; lot: Lot }> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the lot row
      const lot = await manager
        .createQueryBuilder(Lot, 'lot')
        .setLock('pessimistic_write')
        .where('lot.id = :lotId', { lotId })
        .getOne();

      if (!lot) {
        throw new NotFoundException('Lot not found');
      }

      if (lot.status !== LotStatus.TRADING) {
        throw new BadRequestException('Lot is not currently in trading');
      }

      if (!lot.buyNowPrice) {
        throw new BadRequestException('This lot does not support Buy Now');
      }

      const buyNowPrice = parseFloat(String(lot.buyNowPrice));

      // Check user balance INSIDE the transaction with row-level locking
      const balanceResult = await manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .setLock('pessimistic_write')
        .select('COALESCE(SUM(tx.amount), 0)', 'balance')
        .where('tx.user_id = :userId', { userId })
        .getRawOne();

      const balance = parseFloat(balanceResult?.balance || '0');
      if (balance < buyNowPrice) {
        throw new BadRequestException('Insufficient balance');
      }

      // Create bid record for the buy-now
      const bid = manager.create(Bid, {
        lotId,
        userId,
        amount: buyNowPrice,
        idempotencyKey: `buy-now:${lotId}:${userId}:${Date.now()}`,
        isPreBid: false,
        maxAutoBid: null,
      });
      const savedBid = await manager.save(Bid, bid);

      // Update lot: mark as sold, set winner
      lot.status = LotStatus.SOLD;
      lot.winnerId = userId;
      lot.currentPrice = buyNowPrice;
      const updatedLot = await manager.save(Lot, lot);

      return { bid: savedBid, lot: updatedLot };
    });
  }

  /**
   * Get paginated bids for a specific lot, ordered by amount DESC.
   * Does not expose full user relations - only returns safe bid data.
   */
  async getBidsByLot(
    lotId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Array<{
      id: string;
      lotId: string;
      amount: number;
      isPreBid: boolean;
      createdAt: Date;
      bidderFlag: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    // Verify lot exists
    const lot = await this.lotRepository.findOne({ where: { id: lotId } });
    if (!lot) {
      throw new NotFoundException('Lot not found');
    }

    const [bids, total] = await this.bidRepository.findAndCount({
      where: { lotId },
      order: { amount: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Map bids to safe output without user relations
    const data = bids.map((bid) => ({
      id: bid.id,
      lotId: bid.lotId,
      amount: bid.amount,
      isPreBid: bid.isPreBid,
      createdAt: bid.createdAt,
      bidderFlag: `bidder-${bid.userId.slice(-4)}`,
    }));

    return { data, total, page, limit };
  }

  /**
   * Get paginated bids for the current user, ordered by creation date DESC.
   */
  async getMyBids(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Bid[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [data, total] = await this.bidRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['lot'],
    });

    return { data, total, page, limit };
  }

  /**
   * Get all active lots (status = TRADING and auction not ended).
   */
  async getActiveLots(): Promise<Lot[]> {
    return this.lotRepository.find({
      where: {
        status: LotStatus.TRADING,
        auctionEndAt: MoreThan(new Date()),
      },
      relations: ['images'],
      order: { auctionEndAt: 'ASC' },
    });
  }
}
