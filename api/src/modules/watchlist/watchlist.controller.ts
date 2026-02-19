import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../db/entities/user.entity';
import { AddWatchlistItemDto } from './dto/add-watchlist-item.dto';

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  getUserWatchlist(@CurrentUser() user: User) {
    return this.watchlistService.getUserWatchlist(user.id);
  }

  @Post()
  addToWatchlist(
    @CurrentUser() user: User,
    @Body() dto: AddWatchlistItemDto,
  ) {
    return this.watchlistService.addToWatchlist(user.id, dto);
  }

  @Delete(':id')
  removeFromWatchlist(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.watchlistService.removeFromWatchlist(id, user.id);
  }
}
