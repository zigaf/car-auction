import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceTransaction } from '../../db/entities/balance-transaction.entity';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { AuthModule } from '../auth/auth.module';
import { User } from '../../db/entities/user.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceTransaction, User]), AuthModule, EmailModule],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
