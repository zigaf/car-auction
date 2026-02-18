import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { typeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { LotModule } from './modules/lot/lot.module';
import { ScraperModule } from './modules/scraper/scraper.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig()),
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    LotModule,
    ScraperModule,
  ],
})
export class AppModule {}
