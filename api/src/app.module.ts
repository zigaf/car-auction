import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { typeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { LotModule } from './modules/lot/lot.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { BalanceModule } from './modules/balance/balance.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuctionModule } from './modules/auction/auction.module';
import { OrderModule } from './modules/order/order.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig()),
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    LotModule,
    ScraperModule,
    BalanceModule,
    FavoritesModule,
    WatchlistModule,
    DocumentsModule,
    AuctionModule,
    OrderModule,
  ],
})
export class AppModule {}
