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
import { ImageCategory } from '../../common/enums/image-category.enum';
import { EcarsTradeBrowserService } from './ecarstrade-browser.service';
import { EcarsTradeDataMapperService } from './ecarstrade-data-mapper.service';
import { ScraperGateway } from './scraper.gateway';

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
    private readonly ecarsTradeBrowser: EcarsTradeBrowserService,
    private readonly ecarsTradeMapper: EcarsTradeDataMapperService,
    private readonly gateway: ScraperGateway,
  ) {
    // Pipe eCarsTrade browser logs to our gateway
    this.ecarsTradeBrowser.setLogEmitter((msg) => this.log(msg));
  }

  private log(message: string) {
    this.logger.log(message);
    this.gateway.sendLog(message);
  }

  @Cron(process.env.SCRAPER_CRON || '0 3 * * *')
  async handleCron(): Promise<void> {
    if (process.env.SCRAPER_ENABLED !== 'true') {
      return;
    }
    this.log('Cron triggered scraper run');
    try {
      await this.runScraper('cron', undefined, 'autobid'); // keep default to autobid for cron
    } catch (error) {
      this.logger.error('Cron scraper run failed', error.stack);
    }
  }

  async runScraper(
    triggeredBy: string = 'manual',
    maxPages?: number,
    vendor: string = 'autobid',
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

    this.log(`Starting ${vendor} scraper run (Triggered by: ${triggeredBy})`);

    try {
      if (vendor === 'ecarstrade') {
        await this.runEcarsTradeFlow(run, maxPages);
      } else {
        await this.runAutobidFlow(run, maxPages);
      }

      // Mark completed
      run.status = ScraperRunStatus.COMPLETED;
      run.finishedAt = new Date();
      await this.scraperRunRepository.save(run);

      this.log(
        `Scraper completed: ${run.lotsCreated} created, ${run.lotsUpdated} updated, ${run.imagesDownloaded} images, ${run.errorsCount} errors`,
      );
    } catch (error) {
      run.status = ScraperRunStatus.FAILED;
      run.errorLog = error.message;
      run.finishedAt = new Date();
      await this.scraperRunRepository.save(run);
      this.logger.error('Scraper run failed', error.stack);
      this.log(`Scraper failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }

    return run;
  }

  private async runEcarsTradeFlow(run: ScraperRun, maxPages?: number) {
    try {
      await this.ecarsTradeBrowser.initialize();

      // Get list of cars. In a real scenario you'd paginate, but their list is huge.
      const carLinks = await this.ecarsTradeBrowser.getLiveAuctions();
      const limit = maxPages ? maxPages * 20 : carLinks.length; // rough max pages equivalent
      const linksToProcess = carLinks.slice(0, limit);

      run.totalPages = 1;
      run.lotsFound = carLinks.length;
      await this.scraperRunRepository.save(run);

      this.log(`Found ${carLinks.length} total vehicles. Processing ${linksToProcess.length}...`);

      for (let i = 0; i < linksToProcess.length; i++) {
        const url = linksToProcess[i];
        const vehicleIdMatch = url.match(/\/auctions\/[^\/]+\/(.*?)-?(\d+)$/);
        const vehicleId = vehicleIdMatch ? vehicleIdMatch[2] : `ecars_${i}`;

        this.log(`[${i + 1}/${linksToProcess.length}] Processing lot ${vehicleId}`);

        try {
          // Check if already updated recently
          const existingLot = await this.lotRepository.findOne({
            where: { sourceId: `ecars_${vehicleId}` },
            relations: ['images'],
          });

          if (existingLot && this.isRecentlyUpdated(existingLot, 12)) {
            run.lotsUpdated++;
            this.log(`Skipping recently updated lot: ${vehicleId}`);
            continue;
          }

          await this.crawlDelay(2000, 5000); // Shorter delay for eCarsTrade internal pages

          const detail = await this.ecarsTradeBrowser.scrapeVehicleDetail(url, vehicleId);
          if (!detail) continue;

          const lotData = this.ecarsTradeMapper.mapVehicleToLot(detail, vehicleId, url);
          const categorizedImages = (lotData as any)._categorizedImages || [];
          delete (lotData as any)._categorizedImages;

          if (existingLot) {
            await this.lotRepository.update(existingLot.id, lotData as any);
            run.lotsUpdated++;
            if (!existingLot.images || existingLot.images.length === 0) {
              await this.saveCategorizedImagesFromExternal(existingLot, categorizedImages, run);
            }
          } else {
            let newLot = this.lotRepository.create(lotData);
            newLot = await this.lotRepository.save(newLot);
            run.lotsCreated++;
            await this.saveCategorizedImagesFromExternal(newLot, categorizedImages, run);
          }
        } catch (error) {
          run.errorsCount++;
          this.log(`Error processing ${vehicleId}: ${error.message}`);
        }
      }
      run.pagesScraped = 1;
    } finally {
      await this.ecarsTradeBrowser.destroy();
    }
  }

  private async saveCategorizedImagesFromExternal(lot: Lot, images: { url: string, category: string }[], run: ScraperRun) {
    if (!images || images.length === 0) return;

    const categoryMap: Record<string, ImageCategory> = {
      main: ImageCategory.MAIN,
      exterior: ImageCategory.EXTERIOR,
      interior: ImageCategory.INTERIOR,
      damage: ImageCategory.DAMAGE,
      document: ImageCategory.DOCUMENT,
    };

    try {
      let sortOrder = 0;
      for (const img of images) {
        const category = categoryMap[img.category] || ImageCategory.EXTERIOR;
        const lotImage = this.lotImageRepository.create({
          url: img.url,
          category,
          sortOrder: sortOrder++,
          lotId: lot.id,
        });
        await this.lotImageRepository.save(lotImage);
        run.imagesDownloaded++;
      }
    } catch (e) {
      this.logger.warn(`Failed to save ecars images for lot ${lot.id}`);
    }
  }

  private async runAutobidFlow(run: ScraperRun, maxPages?: number) {
    try {
      await this.browserService.initialize();

      const firstPage = await this.browserService.fetchSearchPage(1);
      const totalVehiclesOnPage = firstPage.vehicles.length;

      this.log(`Search page 1: ${totalVehiclesOnPage} vehicles, totalCount=${firstPage.totalCount}, totalPages=${firstPage.totalPages}`);

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

      this.log(`Will scrape ${pagesToScrape} pages (${run.lotsFound} total vehicles)`);

      if (totalVehiclesOnPage === 0 && (firstPage as any)._debugHtml) {
        run.errorLog = `DEBUG: No vehicles on page 1. HTML: ${(firstPage as any)._debugHtml}`;
        await this.scraperRunRepository.save(run);
      }

      await this.processVehicleCards(firstPage.vehicles, run);
      run.pagesScraped = 1;
      await this.scraperRunRepository.save(run);

      for (let page = 2; page <= pagesToScrape; page++) {
        await this.crawlDelay();

        try {
          const pageData = await this.browserService.fetchSearchPage(page);
          await this.processVehicleCards(pageData.vehicles, run);
        } catch (error) {
          run.errorsCount++;
          this.log(`Failed to process page ${page}: ${error.message}`);
        }

        run.pagesScraped = page;
        await this.scraperRunRepository.save(run);
      }
    } finally {
      await this.browserService.destroy();
    }
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

        // Skip recently updated lots
        const hasGoodData = lot && lot.images?.length > 2 && lot.mileage;
        if (lot && hasGoodData && this.isRecentlyUpdated(lot, 12)) {
          run.lotsUpdated++;
          // this.log(`Skipping recently updated lot: ${vehicleId}`);
          continue;
        }
        if (lot && !hasGoodData) {
          // this.log(`Re-scraping lot ${vehicleId} (incomplete data)`);
        }

        await this.crawlDelay();

        const detail = await this.browserService.fetchVehicleDetail(
          card.detailUrl,
          vehicleId,
        );

        const lotData = this.dataMapper.mapVehicleToLot(
          detail,
          vehicleId,
          card.detailUrl,
          card,
        );

        const categorizedImages = (lotData as any)._categorizedImages || [];
        delete (lotData as any)._categorizedImages;

        if (!lotData.startingBid && card.price) {
          lotData.startingBid = this.dataMapper.parseGermanPrice(card.price);
        }

        if (lot) {
          await this.lotRepository.update(lot.id, lotData as any);
          run.lotsUpdated++;
          if (!lot.images || lot.images.length === 0) {
            if (categorizedImages.length > 0) {
              await this.saveCategorizedImages(lot, categorizedImages, run);
            } else {
              const damageUrls = detail.sections?.damageImageUrls || [];
              if (detail.imageUrls.length > 0 || damageUrls.length > 0) {
                await this.saveImageRefs(lot, detail.imageUrls, run, damageUrls);
              }
            }
          }
        } else {
          lot = this.lotRepository.create(lotData);
          lot = await this.lotRepository.save(lot);
          run.lotsCreated++;

          if (categorizedImages.length > 0) {
            await this.saveCategorizedImages(lot, categorizedImages, run);
          } else {
            const damageUrls = detail.sections?.damageImageUrls || [];
            if (detail.imageUrls.length > 0 || damageUrls.length > 0) {
              await this.saveImageRefs(lot, detail.imageUrls, run, damageUrls);
            }
          }
        }
      } catch (error) {
        run.errorsCount++;
        this.log(`Failed to process vehicle ${card.vehicleId}: ${error.message}`);
      }
    }
  }

  private async saveImageRefs(
    lot: Lot,
    imageUrls: string[],
    run: ScraperRun,
    damageImageUrls: string[] = [],
  ): Promise<void> {
    try {
      const imageRefs = this.photoService.createImageRefsFromUrls(imageUrls, damageImageUrls);
      for (const img of imageRefs) {
        const lotImage = this.lotImageRepository.create({
          ...img,
          lotId: lot.id,
        });
        await this.lotImageRepository.save(lotImage);
        run.imagesDownloaded++;
      }
    } catch (error) {
      this.logger.warn(`Failed to save image refs for lot ${lot.id}: ${error.message}`);
      run.errorsCount++;
    }
  }

  private async saveCategorizedImages(
    lot: Lot,
    categorizedImages: { url: string; category: string }[],
    run: ScraperRun,
  ): Promise<void> {
    try {
      const categoryMap: Record<string, ImageCategory> = {
        main: ImageCategory.MAIN,
        exterior: ImageCategory.EXTERIOR,
        interior: ImageCategory.INTERIOR,
        damage: ImageCategory.DAMAGE,
        document: ImageCategory.DOCUMENT,
      };

      const seen = new Set<string>();
      let sortOrder = 0;

      for (const img of categorizedImages) {
        if (seen.has(img.url)) continue;
        seen.add(img.url);

        const category = categoryMap[img.category] || ImageCategory.EXTERIOR;
        const lotImage = this.lotImageRepository.create({
          url: img.url,
          category,
          sortOrder: sortOrder++,
          lotId: lot.id,
        });
        await this.lotImageRepository.save(lotImage);
        run.imagesDownloaded++;
      }
    } catch (error) {
      this.logger.warn(`Failed to save categorized images for lot ${lot.id}: ${error.message}`);
      run.errorsCount++;
    }
  }

  private isRecentlyUpdated(lot: Lot, hours: number): boolean {
    if (!lot.updatedAt) return false;
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - hours);
    return lot.updatedAt > threshold;
  }

  private crawlDelay(minDelay = 10000, maxDelay = 15000): Promise<void> {
    const min = parseInt(process.env.SCRAPER_PAGE_DELAY_MIN || minDelay.toString(), 10);
    const max = parseInt(process.env.SCRAPER_PAGE_DELAY_MAX || maxDelay.toString(), 10);
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
