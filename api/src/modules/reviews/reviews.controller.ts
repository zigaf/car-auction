import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../db/entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.getAll(
      Math.max(parseInt(page || '1', 10), 1),
      Math.min(Math.max(parseInt(limit || '20', 10), 1), 100),
    );
  }

  @Get('stats')
  getStats() {
    return this.reviewsService.getStats();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateReviewDto,
  ) {
    const authorName = dto.authorName?.trim()
      || `${user.firstName} ${user.lastName}`.trim()
      || 'Анонимный пользователь';
    return this.reviewsService.create(user.id, authorName, dto);
  }
}
