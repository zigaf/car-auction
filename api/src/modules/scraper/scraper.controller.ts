import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { TriggerScraperDto } from './dto/trigger-scraper.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('scraper')
@UseGuards(JwtAuthGuard)
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('run')
  async triggerScraper(@Body() dto: TriggerScraperDto) {
    return this.scraperService.runScraper('manual', dto.maxPages);
  }

  @Get('status')
  async getStatus() {
    return this.scraperService.getCurrentStatus();
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
