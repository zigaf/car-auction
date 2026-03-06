import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../db/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { FavoritesService } from '../favorites/favorites.service';

@Injectable()
export class BrokerService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly favoritesService: FavoritesService,
  ) {}

  async getMyTraders(brokerId: string): Promise<User[]> {
    return this.userRepository.find({
      where: { brokerId, role: Role.CLIENT },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async getTraderFavorites(
    brokerId: string,
    traderId: string,
    pagination: { page: number; limit: number },
  ) {
    await this.validateTraderBelongsToBroker(brokerId, traderId);
    return this.favoritesService.getUserFavorites(traderId, pagination);
  }

  async addToTraderWishlist(
    brokerId: string,
    traderId: string,
    lotId: string,
  ) {
    await this.validateTraderBelongsToBroker(brokerId, traderId);
    return this.favoritesService.addFavorite(brokerId, lotId, traderId);
  }

  async removeFromTraderWishlist(
    brokerId: string,
    traderId: string,
    lotId: string,
  ): Promise<void> {
    await this.validateTraderBelongsToBroker(brokerId, traderId);
    return this.favoritesService.removeFavorite(traderId, lotId);
  }

  private async validateTraderBelongsToBroker(
    brokerId: string,
    traderId: string,
  ): Promise<User> {
    const trader = await this.userRepository.findOneBy({ id: traderId });
    if (!trader) throw new NotFoundException('Trader not found');
    if (trader.brokerId !== brokerId) {
      throw new ForbiddenException('Trader is not assigned to your brokerage');
    }
    return trader;
  }
}
