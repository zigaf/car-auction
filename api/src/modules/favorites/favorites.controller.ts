import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../db/entities/user.entity';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  getUserFavorites(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.favoritesService.getUserFavorites(user.id, {
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
    });
  }

  @Get(':lotId/check')
  isFavorite(
    @CurrentUser() user: User,
    @Param('lotId', ParseUUIDPipe) lotId: string,
  ) {
    return this.favoritesService.isFavorite(user.id, lotId);
  }

  @Post(':lotId')
  addFavorite(
    @CurrentUser() user: User,
    @Param('lotId', ParseUUIDPipe) lotId: string,
  ) {
    return this.favoritesService.addFavorite(user.id, lotId);
  }

  @Delete(':lotId')
  removeFavorite(
    @CurrentUser() user: User,
    @Param('lotId', ParseUUIDPipe) lotId: string,
  ) {
    return this.favoritesService.removeFavorite(user.id, lotId);
  }
}
