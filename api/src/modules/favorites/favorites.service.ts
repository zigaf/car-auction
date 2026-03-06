import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../../db/entities/favorite.entity';
import { User } from '../../db/entities/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  async addFavorite(
    actorId: string,
    lotId: string,
    targetUserId?: string,
  ): Promise<Favorite> {
    let effectiveUserId = actorId;

    if (targetUserId) {
      // Verify the caller is a BROKER or ADMIN before allowing delegation
      const actor = await this.userRepository.findOneBy({ id: actorId });
      if (!actor || (actor.role !== Role.BROKER && actor.role !== Role.ADMIN)) {
        throw new ForbiddenException("Only brokers can add to another user's favorites");
      }

      const target = await this.userRepository.findOneBy({ id: targetUserId });
      if (!target) throw new NotFoundException('Target user not found');
      if (target.brokerId !== actorId) {
        throw new ForbiddenException('User is not assigned to your brokerage');
      }
      effectiveUserId = targetUserId;
    }

    const existing = await this.favoriteRepository.findOne({
      where: { userId: effectiveUserId, lotId },
    });

    if (existing) {
      throw new ConflictException('Lot is already in favorites');
    }

    const favorite = this.favoriteRepository.create({
      userId: effectiveUserId,
      lotId,
    });
    return this.favoriteRepository.save(favorite);
  }

  async removeFavorite(actorId: string, lotId: string, targetUserId?: string): Promise<void> {
    let effectiveUserId = actorId;

    if (targetUserId) {
      const actor = await this.userRepository.findOneBy({ id: actorId });
      if (!actor || (actor.role !== Role.BROKER && actor.role !== Role.ADMIN)) {
        throw new ForbiddenException("Only brokers can remove from another user's favorites");
      }
      const target = await this.userRepository.findOneBy({ id: targetUserId });
      if (!target) throw new NotFoundException('Target user not found');
      if (target.brokerId !== actorId) {
        throw new ForbiddenException('User is not assigned to your brokerage');
      }
      effectiveUserId = targetUserId;
    }

    const result = await this.favoriteRepository.delete({ userId: effectiveUserId, lotId });

    if (result.affected === 0) {
      throw new NotFoundException('Favorite not found');
    }
  }

  async isFavorite(actorId: string, lotId: string, targetUserId?: string): Promise<{ isFavorite: boolean }> {
    let effectiveUserId = actorId;

    if (targetUserId) {
      const actor = await this.userRepository.findOneBy({ id: actorId });
      if (!actor || (actor.role !== Role.BROKER && actor.role !== Role.ADMIN)) {
        throw new ForbiddenException("Only brokers can check another user's favorites");
      }
      const target = await this.userRepository.findOneBy({ id: targetUserId });
      if (!target) throw new NotFoundException('Target user not found');
      if (target.brokerId !== actorId) {
        throw new ForbiddenException('User is not assigned to your brokerage');
      }
      effectiveUserId = targetUserId;
    }

    const favorite = await this.favoriteRepository.findOne({
      where: { userId: effectiveUserId, lotId },
    });

    return { isFavorite: !!favorite };
  }
}
