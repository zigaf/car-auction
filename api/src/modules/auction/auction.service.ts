import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { Bid } from '../../db/entities/bid.entity';
import { Lot } from '../../db/entities/lot.entity';
import { User } from '../../db/entities/user.entity';
import { BalanceTransaction } from '../../db/entities/balance-transaction.entity';
import { LotStatus } from '../../common/enums/lot-status.enum';
import { Role } from '../../common/enums/role.enum';
import { BalanceTransactionType } from '../../common/enums/balance-transaction-type.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { Order } from '../../db/entities/order.entity';
import { OrderStatusHistory } from '../../db/entities/order-status-history.entity';
import { BalanceService } from '../balance/balance.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

/** Anti-sniping: if a bid arrives in the last N milliseconds, extend the auction */
const ANTI_SNIPE_WINDOW_MS = 30 * 1000; // 30 seconds
const ANTI_SNIPE_EXTENSION_MS = 2 * 60 * 1000; // 2 minutes

export interface PlaceBidResult {
  bid: Bid;
  autoBids: Bid[];
  auctionExtended: boolean;
  newEndAt: Date | null;
}

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,
    @InjectRepository(Lot)
    private readonly lotRepository: Repository<Lot>,
    private readonly dataSource: DataSource,
    private readonly balanceService: BalanceService,
    private readonly notificationService: NotificationService,
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
      return { bid: existingBid, autoBids: [], auctionExtended: false, newEndAt: null };
    }

    let outbidUserId: string | undefined;

    const result = await this.dataSource.transaction(async (manager) => {
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

      // Load bidder to determine if it is a bot
      const bidder = await manager.findOne(User, { where: { id: userId } });
      const isBotUser = bidder?.role === Role.BOT;

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
      // Bots bypass all balance checks — they have no real balance
      if (!isBotUser) {
        const balanceResult = await manager
          .createQueryBuilder(BalanceTransaction, 'tx')
          .select('COALESCE(SUM(tx.amount), 0)', 'balance')
          .where('tx.user_id = :userId', { userId })
          .getRawOne();

        let availableBalance = parseFloat(balanceResult?.balance || '0');

        // If user already has a BID_LOCK on this lot (raising own bid), that lock
        // will be released, so add it back to the available balance for the check
        const existingLock = await manager
          .createQueryBuilder(BalanceTransaction, 'tx')
          .where('tx.user_id = :userId', { userId })
          .andWhere('tx.lot_id = :lotId', { lotId })
          .andWhere('tx.type = :lockType', {
            lockType: BalanceTransactionType.BID_LOCK,
          })
          .orderBy('tx.created_at', 'DESC')
          .getOne();

        if (existingLock) {
          // Check this lock hasn't already been unlocked
          const alreadyUnlocked = await manager
            .createQueryBuilder(BalanceTransaction, 'tx')
            .where('tx.user_id = :userId', { userId })
            .andWhere('tx.lot_id = :lotId', { lotId })
            .andWhere('tx.type = :unlockType', {
              unlockType: BalanceTransactionType.BID_UNLOCK,
            })
            .andWhere('tx.bid_id = :bidId', { bidId: existingLock.bidId })
            .getOne();

          if (!alreadyUnlocked) {
            availableBalance += Math.abs(existingLock.amount);
          }
        }

        if (availableBalance < amount) {
          throw new BadRequestException('Insufficient balance');
        }
      }

      // Double-check idempotency inside transaction
      const duplicateBid = await manager.findOne(Bid, {
        where: { idempotencyKey },
      });
      if (duplicateBid) {
        return { bid: duplicateBid, autoBids: [], auctionExtended: false, newEndAt: null };
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

      // --- Balance locking ---
      // Find the previous highest bidder to refund their lock
      const previousHighBid = await manager
        .createQueryBuilder(Bid, 'bid')
        .where('bid.lot_id = :lotId', { lotId })
        .andWhere('bid.id != :currentBidId', { currentBidId: savedBid.id })
        .orderBy('bid.amount', 'DESC')
        .getOne();

      if (previousHighBid) {
        if (previousHighBid.userId !== userId) {
          outbidUserId = previousHighBid.userId;
        }
        // Unlock the previous leader's balance (could be same user raising bid)
        await this.balanceService.unlockBalanceForBid(
          manager,
          previousHighBid.userId,
          lotId,
        );
      }

      // Lock the new bidder's balance (skipped for bots — no real balance)
      if (!isBotUser) {
        await this.balanceService.lockBalanceForBid(
          manager,
          userId,
          lotId,
          savedBid.id,
          amount,
        );
      }

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

      // Trigger auto-bids from any existing pre-bids that can counter this bid
      const autoBids = await this.resolveAutoBids(manager, lot, savedBid.id, userId);

      // Reload bid with lot relation only (no user relation to avoid data exposure)
      const fullBid = await manager.findOne(Bid, {
        where: { id: savedBid.id },
        relations: ['lot'],
      });

      return {
        bid: fullBid || savedBid,
        autoBids,
        auctionExtended,
        newEndAt,
      };
    });

    if (outbidUserId) {
      const lotTitle = (result.bid as any).lot?.title || `Лот ${lotId.slice(0, 8)}`;
      this.notificationService
        .create({
          userId: outbidUserId,
          type: NotificationType.OUTBID,
          title: 'Вас перебили',
          message: `Ваша ставка на «${lotTitle}» перебита. Новая ставка: €${amount.toLocaleString()}`,
          data: { lotId, amount },
        })
        .catch((err) => this.logger.warn('Failed to send notification', err));
    }

    return result;
  }

  /**
   * Buy Now: Instantly purchase a lot at the buy-now price.
   * Sets the lot status to SOLD, deducts balance, refunds other bidders, creates order.
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
      const commissionRate = parseFloat(process.env.COMMISSION_RATE || '0.05');
      const commission = Math.round(buyNowPrice * commissionRate * 100) / 100;
      const totalCost = buyNowPrice + commission;

      // Check user balance INSIDE the transaction
      const balanceResult = await manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .select('COALESCE(SUM(tx.amount), 0)', 'balance')
        .where('tx.user_id = :userId', { userId })
        .getRawOne();

      let availableBalance = parseFloat(balanceResult?.balance || '0');

      // If buyer already has a BID_LOCK on this lot, it will be released
      const buyerExistingLock = await manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .where('tx.user_id = :userId', { userId })
        .andWhere('tx.lot_id = :lotId', { lotId })
        .andWhere('tx.type = :lockType', {
          lockType: BalanceTransactionType.BID_LOCK,
        })
        .orderBy('tx.created_at', 'DESC')
        .getOne();

      if (buyerExistingLock) {
        const alreadyUnlocked = await manager
          .createQueryBuilder(BalanceTransaction, 'tx')
          .where('tx.bid_id = :bidId', { bidId: buyerExistingLock.bidId })
          .andWhere('tx.type = :unlockType', {
            unlockType: BalanceTransactionType.BID_UNLOCK,
          })
          .getOne();

        if (!alreadyUnlocked) {
          availableBalance += Math.abs(buyerExistingLock.amount);
        }
      }

      if (availableBalance < totalCost) {
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

      // --- Refund all existing bid locks on this lot ---
      const allLocks = await manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .where('tx.lot_id = :lotId', { lotId })
        .andWhere('tx.type = :lockType', {
          lockType: BalanceTransactionType.BID_LOCK,
        })
        .getMany();

      const refundedUsers = new Set<string>();
      for (const lock of allLocks) {
        if (!refundedUsers.has(lock.userId)) {
          await this.balanceService.unlockBalanceForBid(
            manager,
            lock.userId,
            lotId,
          );
          refundedUsers.add(lock.userId);
        }
      }

      // --- Deduct car price and commission from buyer ---
      const afterRefundBalance = await manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .select('COALESCE(SUM(tx.amount), 0)', 'balance')
        .where('tx.user_id = :userId', { userId })
        .getRawOne();

      let currentBalance = parseFloat(afterRefundBalance?.balance || '0');

      currentBalance -= buyNowPrice;
      const carPaymentTx = manager.create(BalanceTransaction, {
        userId,
        type: BalanceTransactionType.CAR_PAYMENT,
        amount: -buyNowPrice,
        balanceAfter: currentBalance,
        description: `Car payment - ${lot.title || 'Buy Now'}`,
        lotId,
        bidId: savedBid.id,
        createdBy: null,
      });
      await manager.save(BalanceTransaction, carPaymentTx);

      currentBalance -= commission;
      const commissionTx = manager.create(BalanceTransaction, {
        userId,
        type: BalanceTransactionType.COMMISSION,
        amount: -commission,
        balanceAfter: currentBalance,
        description: `Commission - ${lot.title || 'Buy Now'}`,
        lotId,
        bidId: null,
        createdBy: null,
      });
      await manager.save(BalanceTransaction, commissionTx);

      // --- Create order ---
      const order = manager.create(Order, {
        lotId,
        userId,
        carPrice: buyNowPrice,
        commission,
        deliveryCost: 0,
        customsCost: 0,
        total: totalCost,
        status: OrderStatus.PENDING,
      });
      const savedOrder = await manager.save(Order, order);

      const history = manager.create(OrderStatusHistory, {
        orderId: savedOrder.id,
        status: OrderStatus.PENDING,
        comment: 'Order created via Buy Now',
        changedBy: null,
      });
      await manager.save(OrderStatusHistory, history);

      // Link balance transactions to order
      await manager.update(
        BalanceTransaction,
        { id: carPaymentTx.id },
        { orderId: savedOrder.id },
      );
      await manager.update(
        BalanceTransaction,
        { id: commissionTx.id },
        { orderId: savedOrder.id },
      );

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
      userId: string;
      amount: number;
      isPreBid: boolean;
      createdAt: Date;
      bidderFlag: string;
    }>;
    total: number;
    uniqueBidders: number;
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
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Count unique bidders for this lot
    const uniqueBiddersResult = await this.bidRepository
      .createQueryBuilder('bid')
      .select('COUNT(DISTINCT bid.user_id)', 'count')
      .where('bid.lot_id = :lotId', { lotId })
      .getRawOne();
    const uniqueBidders = parseInt(uniqueBiddersResult?.count || '0', 10);

    // Map bids — include userId so the client can identify its own bids
    const data = bids.map((bid) => ({
      id: bid.id,
      lotId: bid.lotId,
      userId: bid.userId,
      amount: bid.amount,
      isPreBid: bid.isPreBid,
      createdAt: bid.createdAt,
      bidderFlag: `bidder-${bid.userId.slice(-4)}`,
    }));

    return { data, total, uniqueBidders, page, limit };
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

  /**
   * Place a pre-bid (auto-bid). The system will automatically bid on behalf
   * of the user up to maxAutoBid amount.
   */
  async placePreBid(
    userId: string,
    lotId: string,
    maxAutoBid: number,
    idempotencyKey: string,
  ): Promise<PlaceBidResult> {
    const existingBid = await this.bidRepository.findOne({
      where: { idempotencyKey },
    });
    if (existingBid) {
      return { bid: existingBid, autoBids: [], auctionExtended: false, newEndAt: null };
    }

    let preOutbidUserId: string | undefined;

    const preBidResult = await this.dataSource.transaction(async (manager) => {
      const lot = await manager
        .createQueryBuilder(Lot, 'lot')
        .setLock('pessimistic_write')
        .where('lot.id = :lotId', { lotId })
        .getOne();

      if (!lot) throw new NotFoundException('Lot not found');
      if (lot.status !== LotStatus.TRADING) {
        throw new BadRequestException('Lot is not currently in trading');
      }
      if (userId === lot.createdBy) {
        throw new ForbiddenException('Cannot bid on your own lot');
      }
      if (lot.auctionEndAt && new Date() > lot.auctionEndAt) {
        throw new BadRequestException('Auction has ended');
      }

      const currentPrice = lot.currentPrice
        ? parseFloat(String(lot.currentPrice))
        : lot.startingBid
          ? parseFloat(String(lot.startingBid))
          : 0;
      const bidStep = parseFloat(String(lot.bidStep)) || 100;
      const minimumBid = currentPrice + bidStep;

      if (maxAutoBid < minimumBid) {
        throw new BadRequestException(
          `Max auto-bid too low. Minimum is ${minimumBid}`,
        );
      }

      // Check balance for the full maxAutoBid amount
      const balanceResult = await manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .select('COALESCE(SUM(tx.amount), 0)', 'balance')
        .where('tx.user_id = :userId', { userId })
        .getRawOne();

      let availableBalance = parseFloat(balanceResult?.balance || '0');

      // Account for existing lock on this lot
      const existingLock = await manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .where('tx.user_id = :userId', { userId })
        .andWhere('tx.lot_id = :lotId', { lotId })
        .andWhere('tx.type = :lockType', {
          lockType: BalanceTransactionType.BID_LOCK,
        })
        .orderBy('tx.created_at', 'DESC')
        .getOne();

      if (existingLock) {
        const alreadyUnlocked = await manager
          .createQueryBuilder(BalanceTransaction, 'tx')
          .where('tx.bid_id = :bidId', { bidId: existingLock.bidId })
          .andWhere('tx.type = :unlockType', {
            unlockType: BalanceTransactionType.BID_UNLOCK,
          })
          .getOne();

        if (!alreadyUnlocked) {
          availableBalance += Math.abs(existingLock.amount);
        }
      }

      if (availableBalance < maxAutoBid) {
        throw new BadRequestException('Insufficient balance for max auto-bid');
      }

      // Idempotency double-check
      const duplicateBid = await manager.findOne(Bid, {
        where: { idempotencyKey },
      });
      if (duplicateBid) {
        return { bid: duplicateBid, autoBids: [], auctionExtended: false, newEndAt: null };
      }

      // Initial bid is at the minimum amount
      const initialAmount = minimumBid;

      const bid = manager.create(Bid, {
        lotId,
        userId,
        amount: initialAmount,
        idempotencyKey,
        isPreBid: true,
        maxAutoBid,
      });
      const savedBid = await manager.save(Bid, bid);

      // Unlock previous leader
      const previousHighBid = await manager
        .createQueryBuilder(Bid, 'bid')
        .where('bid.lot_id = :lotId', { lotId })
        .andWhere('bid.id != :currentBidId', { currentBidId: savedBid.id })
        .orderBy('bid.amount', 'DESC')
        .getOne();

      if (previousHighBid) {
        if (previousHighBid.userId !== userId) {
          preOutbidUserId = previousHighBid.userId;
        }
        await this.balanceService.unlockBalanceForBid(
          manager,
          previousHighBid.userId,
          lotId,
        );
      }

      // Lock balance for the full maxAutoBid amount
      await this.balanceService.lockBalanceForBid(
        manager,
        userId,
        lotId,
        savedBid.id,
        maxAutoBid,
      );

      // Update lot price
      lot.currentPrice = initialAmount;

      // Anti-sniping
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

      // Resolve auto-bids (in case another pre-bid exists)
      const autoBids = await this.resolveAutoBids(manager, lot, savedBid.id, userId);

      const fullBid = await manager.findOne(Bid, {
        where: { id: savedBid.id },
        relations: ['lot'],
      });

      return {
        bid: fullBid || savedBid,
        autoBids,
        auctionExtended,
        newEndAt,
      };
    });

    if (preOutbidUserId) {
      const lotTitle = (preBidResult.bid as any).lot?.title || `Лот ${lotId.slice(0, 8)}`;
      this.notificationService
        .create({
          userId: preOutbidUserId,
          type: NotificationType.OUTBID,
          title: 'Вас перебили',
          message: `Ваша ставка на «${lotTitle}» перебита. Новая максимальная ставка: €${maxAutoBid.toLocaleString()}`,
          data: { lotId, maxAutoBid },
        })
        .catch((err) => this.logger.warn('Failed to send notification', err));
    }

    return preBidResult;
  }

  /**
   * Rollback the highest bid on a lot (admin action).
   * Restores the lot price to the next highest bid and refunds balance locks.
   */
  async rollbackBid(bidId: string): Promise<{ lotId: string; newCurrentPrice: number }> {
    return this.dataSource.transaction(async (manager) => {
      const bid = await manager.findOne(Bid, { where: { id: bidId } });
      if (!bid) throw new NotFoundException('Bid not found');

      const lot = await manager
        .createQueryBuilder(Lot, 'lot')
        .setLock('pessimistic_write')
        .where('lot.id = :lotId', { lotId: bid.lotId })
        .getOne();

      if (!lot) throw new NotFoundException('Lot not found');
      if (lot.status !== LotStatus.TRADING) {
        throw new BadRequestException('Can only rollback bids on active trading lots');
      }

      // Verify this is the highest bid
      const highestBid = await manager
        .createQueryBuilder(Bid, 'bid')
        .where('bid.lot_id = :lotId', { lotId: lot.id })
        .orderBy('bid.amount', 'DESC')
        .addOrderBy('bid.created_at', 'ASC')
        .getOne();

      if (!highestBid || highestBid.id !== bidId) {
        throw new BadRequestException('Only the current highest bid can be rolled back');
      }

      // Unlock the current highest bidder's lock
      await this.balanceService.unlockBalanceForBid(manager, bid.userId, lot.id);

      // Remove the bid
      await manager.delete(Bid, { id: bidId });

      // Find new highest bid
      const newHighestBid = await manager
        .createQueryBuilder(Bid, 'bid')
        .where('bid.lot_id = :lotId', { lotId: lot.id })
        .orderBy('bid.amount', 'DESC')
        .addOrderBy('bid.created_at', 'ASC')
        .getOne();

      const startingBid = lot.startingBid ? parseFloat(String(lot.startingBid)) : 0;
      const newCurrentPrice = newHighestBid
        ? parseFloat(String(newHighestBid.amount))
        : startingBid;

      lot.currentPrice = newCurrentPrice;
      await manager.save(Lot, lot);

      return { lotId: lot.id, newCurrentPrice };
    });
  }

  /**
   * Resolve auto-bids after a new bid is placed.
   * Checks if any pre-bidders can counter-bid, and processes them.
   */
  private async resolveAutoBids(
    manager: ReturnType<DataSource['createQueryRunner']>['manager'],
    lot: Lot,
    excludeBidId: string,
    currentBidderId: string,
    depth: number = 0,
  ): Promise<Bid[]> {
    if (depth >= 50) return [];

    const currentPrice = parseFloat(String(lot.currentPrice)) || 0;
    const bidStep = parseFloat(String(lot.bidStep)) || 100;
    const nextBidAmount = currentPrice + bidStep;

    // Find active pre-bids that can still auto-bid
    const preBids = await manager
      .createQueryBuilder(Bid, 'bid')
      .where('bid.lot_id = :lotId', { lotId: lot.id })
      .andWhere('bid.is_pre_bid = true')
      .andWhere('bid.max_auto_bid >= :nextAmount', {
        nextAmount: nextBidAmount,
      })
      .andWhere('bid.user_id != :currentBidderId', { currentBidderId })
      .orderBy('bid.max_auto_bid', 'DESC')
      .addOrderBy('bid.created_at', 'ASC')
      .getMany();

    if (preBids.length === 0) return [];

    const topPreBid = preBids[0];
    const topMaxBid = parseFloat(String(topPreBid.maxAutoBid));

    // Determine auto-bid amount
    let autoBidAmount = nextBidAmount;

    // If the current bidder also has a pre-bid, compete
    const currentBidderPreBid = await manager
      .createQueryBuilder(Bid, 'bid')
      .where('bid.lot_id = :lotId', { lotId: lot.id })
      .andWhere('bid.is_pre_bid = true')
      .andWhere('bid.user_id = :currentBidderId', { currentBidderId })
      .andWhere('bid.max_auto_bid >= :nextAmount', {
        nextAmount: nextBidAmount,
      })
      .orderBy('bid.max_auto_bid', 'DESC')
      .getOne();

    if (currentBidderPreBid) {
      const currentMax = parseFloat(String(currentBidderPreBid.maxAutoBid));
      // Second-price + bidStep logic
      autoBidAmount = Math.min(topMaxBid, currentMax + bidStep);
      if (autoBidAmount > topMaxBid) {
        autoBidAmount = topMaxBid;
      }
    }

    // Cap at the pre-bidder's max
    autoBidAmount = Math.min(autoBidAmount, topMaxBid);

    // Create the auto-bid
    const autoBid = manager.create(Bid, {
      lotId: lot.id,
      userId: topPreBid.userId,
      amount: autoBidAmount,
      idempotencyKey: `auto:${lot.id}:${topPreBid.userId}:${Date.now()}:${depth}`,
      isPreBid: true,
      maxAutoBid: topMaxBid,
    });
    const savedAutoBid = await manager.save(Bid, autoBid);

    // Unlock previous leader's balance, lock auto-bidder's
    // The previous leader was currentBidderId
    await this.balanceService.unlockBalanceForBid(
      manager,
      currentBidderId,
      lot.id,
    );
    await this.balanceService.lockBalanceForBid(
      manager,
      topPreBid.userId,
      lot.id,
      savedAutoBid.id,
      autoBidAmount,
    );

    // Update lot price
    lot.currentPrice = autoBidAmount;
    await manager.save(Lot, lot);

    // Recurse in case the outbid user also has a pre-bid
    const nestedAutoBids = await this.resolveAutoBids(
      manager,
      lot,
      savedAutoBid.id,
      topPreBid.userId,
      depth + 1,
    );
    return [savedAutoBid, ...nestedAutoBids];
  }
}
