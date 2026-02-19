import {
  Injectable,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lot } from '../../db/entities/lot.entity';
import { LotImage } from '../../db/entities/lot-image.entity';
import { ScraperRun } from '../../db/entities/scraper-run.entity';
import { ScraperRunStatus } from '../../common/enums/scraper-run-status.enum';
import { BcaBrowserService } from './bca-browser.service';
import { BcaDataMapperService } from './bca-data-mapper.service';
import { PhotoDownloadService } from './photo-download.service';
import { BcaVehicle } from './interfaces/bca-vehicle.interface';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Lot)
    private readonly lotRepository: Repository<Lot>,
    @InjectRepository(LotImage)
    private readonly lotImageRepository: Repository<LotImage>,
    @InjectRepository(ScraperRun)
    private readonly scraperRunRepository: Repository<ScraperRun>,
    private readonly browserService: BcaBrowserService,
    private readonly dataMapper: BcaDataMapperService,
    private readonly photoService: PhotoDownloadService,
  ) {}

  @Cron(process.env.SCRAPER_CRON || '0 3 * * *')
  async handleCron(): Promise<void> {
    if (process.env.SCRAPER_ENABLED !== 'true') {
      return;
    }
    this.logger.log('Cron triggered scraper run');
    try {
      await this.runScraper('cron');
    } catch (error) {
      this.logger.error('Cron scraper run failed', error.stack);
    }
  }

  async runScraper(
    triggeredBy: string = 'manual',
    maxPages?: number,
  ): Promise<ScraperRun> {
    if (this.isRunning) {
      throw new ConflictException('Scraper is already running');
    }
    this.isRunning = true;

    const run = this.scraperRunRepository.create({
      status: ScraperRunStatus.RUNNING,
      triggeredBy,
      startedAt: new Date(),
    });
    await this.scraperRunRepository.save(run);

    try {
      // Initialize browser and establish session
      await this.browserService.initialize();

      // Fetch first page to get total count
      const firstPage = await this.browserService.fetchVehiclePage(1);
      const totalVehicles = firstPage.TotalVehicleCount || 0;
      const pageSize = firstPage.PageSize || 50;
      const vehiclesOnFirstPage = firstPage.VehicleResults?.length || 0;
      const totalPages = totalVehicles > 0
        ? Math.ceil(totalVehicles / pageSize)
        : vehiclesOnFirstPage > 0 ? 1 : 0;

      this.logger.log(
        `BCA response: TotalVehicleCount=${firstPage.TotalVehicleCount}, PageSize=${firstPage.PageSize}, vehiclesOnPage=${vehiclesOnFirstPage}`,
      );

      const configMaxPages = parseInt(process.env.SCRAPER_MAX_PAGES || '0', 10);
      const pagesToScrape = maxPages
        ? Math.min(maxPages, totalPages || maxPages)
        : configMaxPages > 0
          ? Math.min(configMaxPages, totalPages || configMaxPages)
          : totalPages;

      run.totalPages = pagesToScrape || 1;
      run.lotsFound = totalVehicles || vehiclesOnFirstPage;
      await this.scraperRunRepository.save(run);

      this.logger.log(
        `Scraping ${pagesToScrape} pages (${totalVehicles} total vehicles)`,
      );

      // Process first page
      await this.processVehicles(firstPage.VehicleResults, run);
      run.pagesScraped = 1;
      await this.scraperRunRepository.save(run);

      // Fetch remaining pages with rate limiting
      for (let page = 2; page <= pagesToScrape; page++) {
        await this.randomDelay(
          parseInt(process.env.SCRAPER_PAGE_DELAY_MIN || '3000', 10),
          parseInt(process.env.SCRAPER_PAGE_DELAY_MAX || '8000', 10),
        );

        try {
          const pageData = await this.browserService.fetchVehiclePage(page);
          await this.processVehicles(pageData.VehicleResults, run);
        } catch (error) {
          run.errorsCount++;
          this.logger.warn(`Failed to process page ${page}: ${error.message}`);
        }

        run.pagesScraped = page;
        await this.scraperRunRepository.save(run);
      }

      // Mark completed
      run.status = ScraperRunStatus.COMPLETED;
      run.finishedAt = new Date();
      await this.scraperRunRepository.save(run);

      this.logger.log(
        `Scraper completed: ${run.lotsCreated} created, ${run.lotsUpdated} updated, ${run.imagesDownloaded} images, ${run.errorsCount} errors`,
      );
    } catch (error) {
      run.status = ScraperRunStatus.FAILED;
      run.errorLog = error.message;
      run.finishedAt = new Date();
      await this.scraperRunRepository.save(run);
      this.logger.error('Scraper run failed', error.stack);
    } finally {
      await this.browserService.destroy();
      this.isRunning = false;
    }

    return run;
  }

  async getCurrentStatus(): Promise<{
    isRunning: boolean;
    latestRun: ScraperRun | null;
  }> {
    const latestRun = await this.scraperRunRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    return {
      isRunning: this.isRunning,
      latestRun,
    };
  }

  async getScraperRuns(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: ScraperRun[]; total: number }> {
    const [data, total] = await this.scraperRunRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async getScraperRunById(id: string): Promise<ScraperRun | null> {
    return this.scraperRunRepository.findOne({ where: { id } });
  }

  private async processVehicles(
    vehicles: BcaVehicle[],
    run: ScraperRun,
  ): Promise<void> {
    for (const vehicle of vehicles) {
      try {
        let lot = await this.lotRepository.findOne({
          where: { bcaLotId: vehicle.LotId },
          relations: ['images'],
        });

        const lotData = this.dataMapper.mapVehicleToLot(vehicle);

        if (lot) {
          // Update existing lot
          await this.lotRepository.update(lot.id, lotData as any);
          run.lotsUpdated++;

          // Save image refs for lots that have no images yet
          if ((!lot.images || lot.images.length === 0) && (vehicle.ImageUrl || vehicle.Imagekey)) {
            await this.saveImageRefsFromApi(lot, vehicle, run);
          }
        } else {
          // Create new lot
          lot = this.lotRepository.create(lotData);
          lot = await this.lotRepository.save(lot);
          run.lotsCreated++;

          // Save image refs from API response (fast, no extra navigation)
          if (vehicle.ImageUrl || vehicle.Imagekey) {
            await this.saveImageRefsFromApi(lot, vehicle, run);
          }

          // Optionally download full gallery photos (slow, navigates to each lot page)
          if (process.env.SCRAPER_DOWNLOAD_PHOTOS === 'true') {
            await this.downloadPhotosForLot(lot, vehicle, run);
          }
        }
      } catch (error) {
        run.errorsCount++;
        this.logger.warn(
          `Failed to process vehicle ${vehicle.VIN || vehicle.LotId}: ${error.message}`,
        );
      }
    }
  }

  private async saveImageRefsFromApi(
    lot: Lot,
    vehicle: BcaVehicle,
    run: ScraperRun,
  ): Promise<void> {
    try {
      const imageRefs = this.photoService.createImageRefsFromApi(
        vehicle.ImageUrl,
        vehicle.Imagekey,
      );

      for (const img of imageRefs) {
        const lotImage = this.lotImageRepository.create({
          ...img,
          lotId: lot.id,
        });
        await this.lotImageRepository.save(lotImage);
        run.imagesDownloaded++;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to save image refs for lot ${lot.id}: ${error.message}`,
      );
      run.errorsCount++;
    }
  }

  private async downloadPhotosForLot(
    lot: Lot,
    vehicle: BcaVehicle,
    run: ScraperRun,
  ): Promise<void> {
    try {
      // Rate limit before navigating to lot page
      await this.randomDelay(
        parseInt(process.env.SCRAPER_PAGE_DELAY_MIN || '3000', 10),
        parseInt(process.env.SCRAPER_PAGE_DELAY_MAX || '8000', 10),
      );

      // Extract docIds by navigating to lot page
      const docIds = await this.browserService.extractPhotoDocIds(
        vehicle.ViewLotUrl,
      );

      if (docIds.length > 0 || vehicle.ImageUrl) {
        const imageData = await this.photoService.downloadLotPhotos(
          lot.id,
          vehicle.VIN || lot.id,
          docIds,
          vehicle.ImageUrl,
        );

        for (const img of imageData) {
          const lotImage = this.lotImageRepository.create({
            ...img,
            lotId: lot.id,
          });
          await this.lotImageRepository.save(lotImage);
          run.imagesDownloaded++;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to download photos for lot ${lot.id}: ${error.message}`,
      );
      run.errorsCount++;
    }
  }

  private randomDelay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
