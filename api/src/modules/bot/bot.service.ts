import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from '../../db/entities/user.entity';
import { AuctionBotConfig } from '../../db/entities/auction-bot-config.entity';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { CreateBotUserDto } from './dto/create-bot-user.dto';
import { CreateBotConfigDto } from './dto/create-bot-config.dto';
import { UpdateBotConfigDto } from './dto/update-bot-config.dto';

@Injectable()
export class BotService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuctionBotConfig)
    private readonly configRepository: Repository<AuctionBotConfig>,
  ) {}

  // ─── Bot Users ──────────────────────────────────────────────────────────────

  async createBotUser(dto: CreateBotUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const bot = this.userRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      countryFlag: dto.countryFlag ?? '',
      avatarUrl: dto.avatarUrl ?? null,
      passwordHash: null,
      role: Role.BOT,
      status: UserStatus.ACTIVE,
      isVerified: true,
      referralCode: randomUUID().slice(0, 8).toUpperCase(),
      referredById: null,
    });

    return this.userRepository.save(bot);
  }

  async findBotUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: { role: Role.BOT },
      order: { createdAt: 'DESC' },
    });
  }

  async removeBotUser(id: string): Promise<void> {
    const bot = await this.userRepository.findOne({
      where: { id, role: Role.BOT },
    });
    if (!bot) throw new NotFoundException('Bot user not found');
    await this.userRepository.remove(bot);
  }

  // ─── Bot Configs ─────────────────────────────────────────────────────────────

  async createConfig(dto: CreateBotConfigDto): Promise<AuctionBotConfig> {
    const botUser = await this.userRepository.findOne({
      where: { id: dto.botUserId, role: Role.BOT },
    });
    if (!botUser) throw new NotFoundException('Bot user not found');

    const config = this.configRepository.create({
      lotId: dto.lotId,
      botUserId: dto.botUserId,
      maxPrice: dto.maxPrice,
      pattern: dto.pattern,
      isActive: dto.isActive ?? true,
      minDelaySec: dto.minDelaySec ?? 2,
      maxDelaySec: dto.maxDelaySec ?? 10,
      intensity: dto.intensity ?? 1.0,
      startMinutesBeforeEnd: dto.startMinutesBeforeEnd ?? null,
    });

    return this.configRepository.save(config);
  }

  async findConfigs(lotId?: string): Promise<AuctionBotConfig[]> {
    const where = lotId ? { lotId } : {};
    return this.configRepository.find({
      where,
      relations: ['botUser', 'lot'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateConfig(id: string, dto: UpdateBotConfigDto): Promise<AuctionBotConfig> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) throw new NotFoundException('Bot config not found');

    if (dto.maxPrice !== undefined) config.maxPrice = dto.maxPrice;
    if (dto.pattern !== undefined) config.pattern = dto.pattern;
    if (dto.isActive !== undefined) config.isActive = dto.isActive;
    if (dto.minDelaySec !== undefined) config.minDelaySec = dto.minDelaySec;
    if (dto.maxDelaySec !== undefined) config.maxDelaySec = dto.maxDelaySec;
    if (dto.intensity !== undefined) config.intensity = dto.intensity;
    if ('startMinutesBeforeEnd' in dto) config.startMinutesBeforeEnd = dto.startMinutesBeforeEnd ?? null;

    return this.configRepository.save(config);
  }

  async removeConfig(id: string): Promise<void> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) throw new NotFoundException('Bot config not found');
    await this.configRepository.remove(config);
  }
}
