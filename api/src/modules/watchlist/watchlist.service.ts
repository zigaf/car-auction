import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchlistItem } from '../../db/entities/watchlist.entity';
import { AddWatchlistItemDto } from './dto/add-watchlist-item.dto';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(WatchlistItem)
    private readonly watchlistRepository: Repository<WatchlistItem>,
  ) {}

  async getUserWatchlist(userId: string): Promise<WatchlistItem[]> {
    return this.watchlistRepository.find({
      where: { userId },
      relations: ['lot', 'lot.images'],
      order: { createdAt: 'DESC' },
    });
  }

  async addToWatchlist(
    userId: string,
    dto: AddWatchlistItemDto,
  ): Promise<WatchlistItem> {
    const item = this.watchlistRepository.create({
      userId,
      lotId: dto.lotId || null,
      brand: dto.brand || null,
      model: dto.model || null,
    });

    return this.watchlistRepository.save(item);
  }

  async removeFromWatchlist(id: string, userId: string): Promise<void> {
    const result = await this.watchlistRepository.delete({ id, userId });

    if (result.affected === 0) {
      throw new NotFoundException('Watchlist item not found');
    }
  }
}
