import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../../db/entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
  ) {}

  async getUserFavorites(
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<{
    data: Favorite[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = pagination;

    const [data, total] = await this.favoriteRepository.findAndCount({
      where: { userId },
      relations: ['lot', 'lot.images'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async addFavorite(userId: string, lotId: string): Promise<Favorite> {
    const existing = await this.favoriteRepository.findOne({
      where: { userId, lotId },
    });

    if (existing) {
      throw new ConflictException('Lot is already in favorites');
    }

    const favorite = this.favoriteRepository.create({ userId, lotId });
    return this.favoriteRepository.save(favorite);
  }

  async removeFavorite(userId: string, lotId: string): Promise<void> {
    const result = await this.favoriteRepository.delete({ userId, lotId });

    if (result.affected === 0) {
      throw new NotFoundException('Favorite not found');
    }
  }

  async isFavorite(userId: string, lotId: string): Promise<{ isFavorite: boolean }> {
    const favorite = await this.favoriteRepository.findOne({
      where: { userId, lotId },
    });

    return { isFavorite: !!favorite };
  }
}
