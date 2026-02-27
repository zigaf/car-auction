import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bid } from '../../db/entities/bid.entity';
import { Lot } from '../../db/entities/lot.entity';
import { User } from '../../db/entities/user.entity';
import { BalanceTransaction } from '../../db/entities/balance-transaction.entity';
import { Order } from '../../db/entities/order.entity';
import { OrderStatusHistory } from '../../db/entities/order-status-history.entity';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { AuctionGateway } from './auction.gateway';
import { AuctionSchedulerService } from './auction-scheduler.service';
import { BalanceModule } from '../balance/balance.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bid,
      Lot,
      User,
      BalanceTransaction,
      Order,
      OrderStatusHistory,
    ]),
    BalanceModule,
    AuthModule,
    NotificationModule,
  ],
  controllers: [AuctionController],
  providers: [AuctionService, AuctionGateway, AuctionSchedulerService],
  exports: [AuctionService, AuctionGateway],
})
export class AuctionModule {}
