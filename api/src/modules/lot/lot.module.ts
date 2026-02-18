import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lot } from '../../db/entities/lot.entity';
import { LotImage } from '../../db/entities/lot-image.entity';
import { LotController } from './lot.controller';
import { LotService } from './lot.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lot, LotImage])],
  controllers: [LotController],
  providers: [LotService],
  exports: [LotService],
})
export class LotModule {}
