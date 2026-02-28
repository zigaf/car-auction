import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { TriggerScraperDto } from './dto/trigger-scraper.dto';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) { }

  @Post('run')
  async triggerScraper(@Body() dto: TriggerScraperDto) {
    const vendor = dto.vendor || 'ecarstrade';
    return this.scraperService.runScraper('manual', dto.maxPages, vendor);
  }

  @Post('stop')
  async stopScraper() {
    await this.scraperService.stop();
    return { success: true, message: 'Парсер останавливается...' };
  }

  @Get('status')
  async getStatus() {
    return {
      ...await this.scraperService.getCurrentStatus(),
      isStopping: (this.scraperService as any).stopRequested
    };
  }

  @Get('runs')
  async getScraperRuns(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.scraperService.getScraperRuns(page, limit);
  }

  @Get('runs/:id')
  async getScraperRun(@Param('id') id: string) {
    return this.scraperService.getScraperRunById(id);
  }
}
