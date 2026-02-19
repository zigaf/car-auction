import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceTransaction } from '../../db/entities/balance-transaction.entity';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceTransaction]), AuthModule],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
