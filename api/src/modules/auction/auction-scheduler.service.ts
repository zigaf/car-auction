import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { Lot } from '../../db/entities/lot.entity';
import { Bid } from '../../db/entities/bid.entity';
import { Order } from '../../db/entities/order.entity';
import { OrderStatusHistory } from '../../db/entities/order-status-history.entity';
import { BalanceTransaction } from '../../db/entities/balance-transaction.entity';
import { LotStatus } from '../../common/enums/lot-status.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { BalanceTransactionType } from '../../common/enums/balance-transaction-type.enum';
import { AuctionGateway } from './auction.gateway';
import { BalanceService } from '../balance/balance.service';

@Injectable()
export class AuctionSchedulerService {
  private readonly logger = new Logger(AuctionSchedulerService.name);
  private processing = false;

  constructor(
    @InjectRepository(Lot)
    private readonly lotRepository: Repository<Lot>,
    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,
    private readonly dataSource: DataSource,
    private readonly auctionGateway: AuctionGateway,
    private readonly balanceService: BalanceService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleAuctionEnd(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const expiredLots = await this.lotRepository.find({
        where: {
          status: LotStatus.TRADING,
          auctionEndAt: LessThanOrEqual(new Date()),
        },
      });

      for (const lot of expiredLots) {
        await this.processAuctionEnd(lot);
      }
    } catch (error) {
      this.logger.error('Error in auction scheduler', error);
    } finally {
      this.processing = false;
    }
  }

  private async processAuctionEnd(lot: Lot): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      // Lock the lot row to prevent concurrent modifications
      const lockedLot = await manager
        .createQueryBuilder(Lot, 'lot')
        .setLock('pessimistic_write')
        .where('lot.id = :lotId', { lotId: lot.id })
        .getOne();

      if (!lockedLot || lockedLot.status !== LotStatus.TRADING) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Double-check auction has ended
      if (lockedLot.auctionEndAt && new Date() < lockedLot.auctionEndAt) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Find the highest bid
      const winningBid = await manager
        .createQueryBuilder(Bid, 'bid')
        .where('bid.lot_id = :lotId', { lotId: lot.id })
        .orderBy('bid.amount', 'DESC')
        .addOrderBy('bid.created_at', 'ASC')
        .getOne();

      if (winningBid) {
        const finalPrice = parseFloat(String(winningBid.amount));

        // Check reserve price
        const reservePrice = lockedLot.reservePrice
          ? parseFloat(String(lockedLot.reservePrice))
          : null;

        if (reservePrice && finalPrice < reservePrice) {
          // Reserve not met — cancel and refund all
          lockedLot.status = LotStatus.CANCELLED;
          await manager.save(Lot, lockedLot);

          await this.refundAllBidLocks(manager, lot.id);

          await queryRunner.commitTransaction();

          this.auctionGateway.emitAuctionEnded(lot.id, null, 0);
          this.logger.log(
            `Auction cancelled (reserve not met): lot=${lot.id}, highest=${finalPrice}, reserve=${reservePrice}`,
          );
          return;
        }

        // --- Winner found ---
        lockedLot.status = LotStatus.SOLD;
        lockedLot.winnerId = winningBid.userId;
        lockedLot.currentPrice = finalPrice;
        await manager.save(Lot, lockedLot);

        // Unlock winner's bid lock
        await this.balanceService.unlockBalanceForBid(
          manager,
          winningBid.userId,
          lot.id,
        );

        // Deduct car price + commission from winner
        const commissionRate = parseFloat(
          process.env.COMMISSION_RATE || '0.05',
        );
        const commission =
          Math.round(finalPrice * commissionRate * 100) / 100;

        const balanceResult = await manager
          .createQueryBuilder(BalanceTransaction, 'tx')
          .select('COALESCE(SUM(tx.amount), 0)', 'balance')
          .where('tx.user_id = :userId', { userId: winningBid.userId })
          .getRawOne();

        let currentBalance = parseFloat(balanceResult?.balance || '0');

        currentBalance -= finalPrice;
        const carPaymentTx = manager.create(BalanceTransaction, {
          userId: winningBid.userId,
          type: BalanceTransactionType.CAR_PAYMENT,
          amount: -finalPrice,
          balanceAfter: currentBalance,
          description: `Car payment - ${lockedLot.title || 'Auction win'}`,
          lotId: lot.id,
          bidId: winningBid.id,
          createdBy: null,
        });
        await manager.save(BalanceTransaction, carPaymentTx);

        currentBalance -= commission;
        const commissionTx = manager.create(BalanceTransaction, {
          userId: winningBid.userId,
          type: BalanceTransactionType.COMMISSION,
          amount: -commission,
          balanceAfter: currentBalance,
          description: `Commission - ${lockedLot.title || 'Auction win'}`,
          lotId: lot.id,
          bidId: null,
          createdBy: null,
        });
        await manager.save(BalanceTransaction, commissionTx);

        // Create order
        const order = manager.create(Order, {
          lotId: lot.id,
          userId: winningBid.userId,
          carPrice: finalPrice,
          commission,
          deliveryCost: 0,
          customsCost: 0,
          total: finalPrice + commission,
          status: OrderStatus.PENDING,
        });
        const savedOrder = await manager.save(Order, order);

        const history = manager.create(OrderStatusHistory, {
          orderId: savedOrder.id,
          status: OrderStatus.PENDING,
          comment: 'Order created automatically after auction win',
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

        // Refund all other bidders' locks
        await this.refundAllBidLocks(manager, lot.id, winningBid.userId);

        await queryRunner.commitTransaction();

        // Emit events (outside transaction)
        this.auctionGateway.emitAuctionEnded(
          lot.id,
          winningBid.userId,
          finalPrice,
        );

        this.logger.log(
          `Auction ended: lot=${lot.id}, winner=${winningBid.userId}, price=${finalPrice}`,
        );
      } else {
        // --- No bids: cancel ---
        lockedLot.status = LotStatus.CANCELLED;
        await manager.save(Lot, lockedLot);

        await queryRunner.commitTransaction();

        this.auctionGateway.emitAuctionEnded(lot.id, null, 0);
        this.logger.log(`Auction ended with no bids: lot=${lot.id}`);
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to process auction end for lot ${lot.id}`,
        error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Refund all BID_LOCK transactions for a lot, optionally excluding a specific user.
   */
  private async refundAllBidLocks(
    manager: ReturnType<DataSource['createQueryRunner']>['manager'],
    lotId: string,
    excludeUserId?: string,
  ): Promise<void> {
    const query = manager
      .createQueryBuilder(BalanceTransaction, 'tx')
      .where('tx.lot_id = :lotId', { lotId })
      .andWhere('tx.type = :lockType', {
        lockType: BalanceTransactionType.BID_LOCK,
      });

    if (excludeUserId) {
      query.andWhere('tx.user_id != :excludeUserId', { excludeUserId });
    }

    const allLocks = await query.getMany();

    const refundedUsers = new Set<string>();
    for (const lock of allLocks) {
      if (refundedUsers.has(lock.userId)) continue;
      await this.balanceService.unlockBalanceForBid(
        manager,
        lock.userId,
        lotId,
      );
      refundedUsers.add(lock.userId);
    }
  }
}
