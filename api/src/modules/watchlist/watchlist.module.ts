import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchlistItem } from '../../db/entities/watchlist.entity';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([WatchlistItem]), AuthModule],
  controllers: [WatchlistController],
  providers: [WatchlistService],
  exports: [WatchlistService],
})
export class WatchlistModule {}
