import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../db/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserManagerDto } from './dto/update-user-manager.dto';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Role } from '../../common/enums/role.enum';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    return this.authService.toUserResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.userRepository.update(userId, dto);
    return this.getProfile(userId);
  }

  async findAll() {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
    return users.map((u) => this.authService.toUserResponse(u));
  }

  async findById(id: string) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return this.authService.toUserResponse(user);
  }

  async findByIdFull(id: string) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? null,
      avatarUrl: user.avatarUrl ?? null,
      countryFlag: user.countryFlag,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      preferredLanguage: user.preferredLanguage,
      preferredCurrency: user.preferredCurrency,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async activate(id: string) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);
    return this.authService.toUserResponse(user);
  }

  async block(id: string) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    user.status = UserStatus.BLOCKED;
    await this.userRepository.save(user);
    return this.authService.toUserResponse(user);
  }

  async managerUpdateUser(
    id: string,
    dto: UpdateUserManagerDto,
    callerRole: Role,
  ) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');

    // MANAGER cannot elevate users to ADMIN
    if (dto.role === Role.ADMIN && callerRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can assign the ADMIN role');
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.countryFlag !== undefined) user.countryFlag = dto.countryFlag;
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.isVerified !== undefined) user.isVerified = dto.isVerified;
    if (dto.role !== undefined) user.role = dto.role;

    await this.userRepository.save(user);
    return this.authService.toUserResponse(user);
  }
}
