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
import { AutobidBrowserService } from './autobid-browser.service';
import { AutobidDataMapperService } from './autobid-data-mapper.service';
import { PhotoDownloadService } from './photo-download.service';
import { AutobidVehicleCard } from './interfaces/autobid-vehicle.interface';

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
    private readonly browserService: AutobidBrowserService,
    private readonly dataMapper: AutobidDataMapperService,
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
      // Initialize browser
      await this.browserService.initialize();

      // Phase 1: Fetch first search page to discover pagination
      const firstPage = await this.browserService.fetchSearchPage(1);
      const totalVehiclesOnPage = firstPage.vehicles.length;

      this.logger.log(
        `Search page 1: ${totalVehiclesOnPage} vehicles, totalCount=${firstPage.totalCount}, totalPages=${firstPage.totalPages}`,
      );

      const totalPages = firstPage.totalPages || (totalVehiclesOnPage > 0 ? 1 : 0);
      const configMaxPages = parseInt(process.env.SCRAPER_MAX_PAGES || '0', 10);
      const pagesToScrape = maxPages
        ? Math.min(maxPages, totalPages || maxPages)
        : configMaxPages > 0
          ? Math.min(configMaxPages, totalPages || configMaxPages)
          : totalPages;

      run.totalPages = pagesToScrape || 1;
      run.lotsFound = firstPage.totalCount || totalVehiclesOnPage;
      await this.scraperRunRepository.save(run);

      this.logger.log(
        `Will scrape ${pagesToScrape} pages (${run.lotsFound} total vehicles)`,
      );

      // Save debug HTML if no vehicles found on first page
      if (totalVehiclesOnPage === 0 && (firstPage as any)._debugHtml) {
        run.errorLog = `DEBUG: No vehicles on page 1. HTML: ${(firstPage as any)._debugHtml}`;
        await this.scraperRunRepository.save(run);
      }

      // Phase 2: Process vehicles from page 1
      await this.processVehicleCards(firstPage.vehicles, run);
      run.pagesScraped = 1;
      await this.scraperRunRepository.save(run);

      // Fetch and process remaining pages
      for (let page = 2; page <= pagesToScrape; page++) {
        // Crawl delay between pages (robots.txt: 10s)
        await this.crawlDelay();

        try {
          const pageData = await this.browserService.fetchSearchPage(page);
          await this.processVehicleCards(pageData.vehicles, run);
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

  /**
   * Process vehicle cards from a search results page.
   * For each card: visit detail page, extract full data, save to DB.
   */
  private async processVehicleCards(
    cards: AutobidVehicleCard[],
    run: ScraperRun,
  ): Promise<void> {
    for (const card of cards) {
      try {
        const vehicleId = card.vehicleId;

        // Check if lot already exists (dedup by sourceId)
        let lot = await this.lotRepository.findOne({
          where: { sourceId: vehicleId },
          relations: ['images'],
        });

        // Skip recently updated lots (updated within last 12 hours)
        if (lot && this.isRecentlyUpdated(lot, 12)) {
          run.lotsUpdated++;
          this.logger.debug(`Skipping recently updated lot: ${vehicleId}`);
          continue;
        }

        // Crawl delay before visiting detail page
        await this.crawlDelay();

        // Fetch full detail from the vehicle page
        const detail = await this.browserService.fetchVehicleDetail(
          card.detailUrl,
          vehicleId,
        );

        // Map to lot entity
        const lotData = this.dataMapper.mapVehicleToLot(
          detail,
          vehicleId,
          card.detailUrl,
        );

        // Use card price as fallback if detail page price is missing
        if (!lotData.startingBid && card.price) {
          lotData.startingBid = this.dataMapper.parseGermanPrice(card.price);
        }

        if (lot) {
          // Update existing lot
          await this.lotRepository.update(lot.id, lotData as any);
          run.lotsUpdated++;

          // Add images if lot has none
          if (
            (!lot.images || lot.images.length === 0) &&
            detail.imageUrls.length > 0
          ) {
            await this.saveImageRefs(lot, detail.imageUrls, run);
          }
        } else {
          // Create new lot
          lot = this.lotRepository.create(lotData);
          lot = await this.lotRepository.save(lot);
          run.lotsCreated++;

          // Save image references
          if (detail.imageUrls.length > 0) {
            await this.saveImageRefs(lot, detail.imageUrls, run);
          }
        }
      } catch (error) {
        run.errorsCount++;
        this.logger.warn(
          `Failed to process vehicle ${card.vehicleId}: ${error.message}`,
        );
      }
    }
  }

  private async saveImageRefs(
    lot: Lot,
    imageUrls: string[],
    run: ScraperRun,
  ): Promise<void> {
    try {
      const imageRefs = this.photoService.createImageRefsFromUrls(imageUrls);

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

  private isRecentlyUpdated(lot: Lot, hours: number): boolean {
    if (!lot.updatedAt) return false;
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - hours);
    return lot.updatedAt > threshold;
  }

  /**
   * Crawl delay respecting robots.txt (10s) + random jitter
   */
  private crawlDelay(): Promise<void> {
    const min = parseInt(process.env.SCRAPER_PAGE_DELAY_MIN || '10000', 10);
    const max = parseInt(process.env.SCRAPER_PAGE_DELAY_MAX || '15000', 10);
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
