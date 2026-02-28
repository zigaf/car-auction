import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lot } from '../../db/entities/lot.entity';
import { LotImage } from '../../db/entities/lot-image.entity';
import { LotController } from './lot.controller';
import { LotService } from './lot.service';
import { AuthModule } from '../auth/auth.module';
import { AuctionModule } from '../auction/auction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lot, LotImage]),
    AuthModule,
    forwardRef(() => AuctionModule),
  ],
  controllers: [LotController],
  providers: [LotService],
  exports: [LotService],
})
export class LotModule {}
