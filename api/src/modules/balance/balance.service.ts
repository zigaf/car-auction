import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
}
