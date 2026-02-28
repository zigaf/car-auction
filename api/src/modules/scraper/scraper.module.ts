import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Lot } from '../../db/entities/lot.entity';
import { LotImage } from '../../db/entities/lot-image.entity';
import { ScraperRun } from '../../db/entities/scraper-run.entity';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { AutobidBrowserService } from './autobid-browser.service';
import { AutobidDataMapperService } from './autobid-data-mapper.service';
import { PhotoDownloadService } from './photo-download.service';
import { AuthModule } from '../auth/auth.module';
import { EcarsTradeBrowserService } from './ecarstrade-browser.service';
import { EcarsTradeDataMapperService } from './ecarstrade-data-mapper.service';
import { ScraperGateway } from './scraper.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lot, LotImage, ScraperRun]),
    HttpModule,
    AuthModule,
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    AutobidBrowserService,
    AutobidDataMapperService,
    PhotoDownloadService,
    EcarsTradeBrowserService,
    EcarsTradeDataMapperService,
    ScraperGateway,
  ],
  exports: [ScraperService],
})
export class ScraperModule { }
