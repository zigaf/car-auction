import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bid } from '../../db/entities/bid.entity';
import { Lot } from '../../db/entities/lot.entity';
import { User } from '../../db/entities/user.entity';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { AuctionGateway } from './auction.gateway';
import { BalanceModule } from '../balance/balance.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bid, Lot, User]),
    BalanceModule,
    AuthModule,
  ],
  controllers: [AuctionController],
  providers: [AuctionService, AuctionGateway],
  exports: [AuctionService],
})
export class AuctionModule {}
