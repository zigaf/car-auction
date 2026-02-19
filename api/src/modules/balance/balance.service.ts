import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BalanceTransaction } from '../../db/entities/balance-transaction.entity';
import { BalanceTransactionType } from '../../common/enums/balance-transaction-type.enum';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceTransaction)
    private readonly transactionRepository: Repository<BalanceTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async getBalance(userId: string): Promise<{ balance: number }> {
    const result = await this.transactionRepository
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'balance')
      .where('tx.user_id = :userId', { userId })
      .getRawOne();

    return { balance: parseFloat(result?.balance || '0') };
  }

  async getTransactions(
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<{
    data: BalanceTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = pagination;

    const [data, total] = await this.transactionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async adjustBalance(
    userId: string,
    amount: number,
    type: BalanceTransactionType,
    description: string,
    managerId: string,
    orderId?: string,
  ): Promise<BalanceTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await queryRunner.manager
        .createQueryBuilder(BalanceTransaction, 'tx')
        .setLock('pessimistic_write')
        .select('COALESCE(SUM(tx.amount), 0)', 'balance')
        .where('tx.user_id = :userId', { userId })
        .getRawOne();

      const currentBalance = parseFloat(result?.balance || '0');
      const balanceAfter = currentBalance + amount;

      const transaction = queryRunner.manager.create(BalanceTransaction, {
        userId,
        type,
        amount,
        balanceAfter,
        description,
        orderId: orderId || null,
        createdBy: managerId,
      });

      const saved = await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lock balance for a bid. Called INSIDE an existing transaction.
   * Creates a negative BID_LOCK transaction.
   */
  async lockBalanceForBid(
    manager: EntityManager,
    userId: string,
    lotId: string,
    bidId: string,
    amount: number,
  ): Promise<BalanceTransaction> {
    const balanceResult = await manager
      .createQueryBuilder(BalanceTransaction, 'tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'balance')
      .where('tx.user_id = :userId', { userId })
      .getRawOne();

    const currentBalance = parseFloat(balanceResult?.balance || '0');
    const balanceAfter = currentBalance - amount;

    const lockTx = manager.create(BalanceTransaction, {
      userId,
      type: BalanceTransactionType.BID_LOCK,
      amount: -amount,
      balanceAfter,
      description: `Bid lock for auction`,
      lotId,
      bidId,
      createdBy: null,
    });

    return manager.save(BalanceTransaction, lockTx);
  }

  /**
   * Unlock balance when user is outbid or auction ends. Called INSIDE an existing transaction.
   * Finds the most recent BID_LOCK for user+lot and creates a positive BID_UNLOCK.
   * Returns null if no active lock found.
   */
  async unlockBalanceForBid(
    manager: EntityManager,
    userId: string,
    lotId: string,
  ): Promise<BalanceTransaction | null> {
    const activeLock = await manager
      .createQueryBuilder(BalanceTransaction, 'tx')
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.lot_id = :lotId', { lotId })
      .andWhere('tx.type = :lockType', {
        lockType: BalanceTransactionType.BID_LOCK,
      })
      .orderBy('tx.created_at', 'DESC')
      .getOne();

    if (!activeLock) return null;

    // Check if this lock was already unlocked
    const existingUnlock = await manager
      .createQueryBuilder(BalanceTransaction, 'tx')
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.lot_id = :lotId', { lotId })
      .andWhere('tx.type = :unlockType', {
        unlockType: BalanceTransactionType.BID_UNLOCK,
      })
      .andWhere('tx.bid_id = :bidId', { bidId: activeLock.bidId })
      .getOne();

    if (existingUnlock) return null;

    const balanceResult = await manager
      .createQueryBuilder(BalanceTransaction, 'tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'balance')
      .where('tx.user_id = :userId', { userId })
      .getRawOne();

    const currentBalance = parseFloat(balanceResult?.balance || '0');
    const unlockAmount = Math.abs(activeLock.amount);
    const balanceAfter = currentBalance + unlockAmount;

    const unlockTx = manager.create(BalanceTransaction, {
      userId,
      type: BalanceTransactionType.BID_UNLOCK,
      amount: unlockAmount,
      balanceAfter,
      description: `Bid unlock - outbid on auction`,
      lotId,
      bidId: activeLock.bidId,
      createdBy: null,
    });

    return manager.save(BalanceTransaction, unlockTx);
  }
}
