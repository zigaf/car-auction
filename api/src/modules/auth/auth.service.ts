import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID, randomBytes } from 'crypto';

import { User } from '../../db/entities/user.entity';
import { RefreshToken } from '../../db/entities/refresh-token.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { OAuthNormalizedProfile } from './oauth/interfaces/oauth-profile.interface';
import { EmailService } from '../email/email.service';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.userRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const referralCode = randomUUID().slice(0, 8).toUpperCase();
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ?? undefined,
      referralCode,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });
    await this.userRepository.save(user);

    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    this.emailService.send(
      EmailEventType.EMAIL_VERIFICATION,
      user.email,
      user.preferredLanguage,
      { firstName: user.firstName, verificationLink },
    ).catch(() => {});

    return { message: 'Registration successful. Please check your email to verify your account.' };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOneBy({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses social login. Please sign in with your social provider.',
      );
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException({ message: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.toUserResponse(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-refresh-secret');
    if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET must be set in production');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash, isRevoked: false },
      relations: ['user'],
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    storedToken.isRevoked = true;
    await this.refreshTokenRepository.save(storedToken);

    const tokens = await this.generateTokens(storedToken.user);
    return {
      user: this.toUserResponse(storedToken.user),
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
  }

  toUserResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      countryFlag: user.countryFlag,
      balance: 0,
      preferredLanguage: user.preferredLanguage,
      preferredCurrency: user.preferredCurrency,
      brokerId: user.brokerId || null,
    };
  }

  async findOrCreateOAuthUser(
    provider: string,
    profile: OAuthNormalizedProfile,
  ): Promise<User> {
    const providerIdColumn = `${provider}Id`;

    // 1. Find by provider ID
    const existingByProvider = await this.userRepository.findOneBy({
      [providerIdColumn]: profile.providerId,
    } as any);

    if (existingByProvider) {
      if (profile.avatarUrl && existingByProvider.avatarUrl !== profile.avatarUrl) {
        existingByProvider.avatarUrl = profile.avatarUrl;
        await this.userRepository.save(existingByProvider);
      }
      return existingByProvider;
    }

    // 2. Find by email and link provider
    if (profile.email) {
      const existingByEmail = await this.userRepository.findOneBy({
        email: profile.email,
      });

      if (existingByEmail) {
        (existingByEmail as any)[providerIdColumn] = profile.providerId;
        if (profile.avatarUrl && !existingByEmail.avatarUrl) {
          existingByEmail.avatarUrl = profile.avatarUrl;
        }
        existingByEmail.isVerified = true;
        existingByEmail.status = UserStatus.ACTIVE;
        await this.userRepository.save(existingByEmail);
        return existingByEmail;
      }
    }

    // 3. Create new user
    const referralCode = randomUUID().slice(0, 8).toUpperCase();
    const newUser = this.userRepository.create({
      email: profile.email || `${provider}_${profile.providerId}@oauth.placeholder`,
      passwordHash: null as any,
      firstName: profile.firstName || 'User',
      lastName: profile.lastName || '',
      avatarUrl: profile.avatarUrl,
      referralCode,
      isVerified: true,
      status: UserStatus.ACTIVE,
      [providerIdColumn]: profile.providerId,
    } as Partial<User>);

    await this.userRepository.save(newUser);
    return newUser as User;
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ emailVerificationToken: token });
    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    user.isVerified = true;
    user.status = UserStatus.ACTIVE;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepository.save(user);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) return;

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException('Account is already verified or not eligible for resend');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('This account uses social login');
    }

    const token = randomBytes(32).toString('hex');
    user.emailVerificationToken = token;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.userRepository.save(user);

    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
    this.emailService.send(
      EmailEventType.EMAIL_VERIFICATION,
      user.email,
      user.preferredLanguage,
      { firstName: user.firstName, verificationLink },
    ).catch(() => {});
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) return;

    if (!user.passwordHash) {
      throw new BadRequestException('This account uses social login. Password reset is not available.');
    }

    const token = randomBytes(32).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await this.userRepository.save(user);

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    this.emailService.send(
      EmailEventType.PASSWORD_RESET,
      user.email,
      user.preferredLanguage,
      { firstName: user.firstName, resetLink },
    ).catch(() => {});
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ passwordResetToken: token });
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);
  }

  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessSecret = process.env.JWT_ACCESS_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-access-secret');
    if (!accessSecret) throw new Error('JWT_ACCESS_SECRET must be set in production');

    const refreshSecret = process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-refresh-secret');
    if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET must be set in production');

    const accessToken = this.jwtService.sign(payload as Record<string, unknown>, {
      secret: accessSecret,
      expiresIn: (process.env.JWT_ACCESS_EXPIRATION || '15m') as any,
    });

    const refreshToken = this.jwtService.sign(payload as Record<string, unknown>, {
      secret: refreshSecret,
      expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as any,
    });

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const tokenEntity = this.refreshTokenRepository.create({
      tokenHash,
      userId: user.id,
      expiresAt,
    });
    await this.refreshTokenRepository.save(tokenEntity);

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
