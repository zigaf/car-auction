import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionBotConfig } from '../../db/entities/auction-bot-config.entity';
import { User } from '../../db/entities/user.entity';
import { Bid } from '../../db/entities/bid.entity';
import { Lot } from '../../db/entities/lot.entity';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { BotEngineService } from './bot-engine.service';
import { AuctionModule } from '../auction/auction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuctionBotConfig, User, Bid, Lot]),
    AuctionModule,
  ],
  controllers: [BotController],
  providers: [BotService, BotEngineService],
})
export class BotModule {}
