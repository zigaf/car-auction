import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Lot } from '../../db/entities/lot.entity';
import { LotImage } from '../../db/entities/lot-image.entity';
import { ScraperRun } from '../../db/entities/scraper-run.entity';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { BcaBrowserService } from './bca-browser.service';
import { BcaDataMapperService } from './bca-data-mapper.service';
import { PhotoDownloadService } from './photo-download.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lot, LotImage, ScraperRun]),
    HttpModule,
    AuthModule,
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    BcaBrowserService,
    BcaDataMapperService,
    PhotoDownloadService,
  ],
  exports: [ScraperService],
})
export class ScraperModule {}
