import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { OAuthService } from './oauth.service';
import { TelegramAuthService } from './telegram-auth.service';
import { AuthService } from '../auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { OAuthProviderConfig } from './interfaces/oauth-provider-config.interface';
import { OAuthNormalizedProfile } from './interfaces/oauth-profile.interface';
import {
  getGoogleConfig,
  getYandexConfig,
  getVkConfig,
} from './oauth-provider.config';
import { UserStatus } from '../../../common/enums/user-status.enum';

@Controller('auth')
export class OAuthController {
  private readonly frontendUrl: string;
  private readonly baseUrl: string;

  constructor(
    private readonly oauthService: OAuthService,
    private readonly authService: AuthService,
    private readonly telegramAuthService: TelegramAuthService,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  }

  // ==================== GOOGLE ====================

  @Get('google')
  googleRedirect(@Res() res: Response) {
    const config = getGoogleConfig();
    const url = this.oauthService.buildAuthorizationUrl(config, this.baseUrl);
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return this.handleOAuthCallback(getGoogleConfig(), code, state, res);
  }

  // ==================== YANDEX ====================

  @Get('yandex')
  yandexRedirect(@Res() res: Response) {
    const config = getYandexConfig();
    const url = this.oauthService.buildAuthorizationUrl(config, this.baseUrl);
    return res.redirect(url);
  }

  @Get('yandex/callback')
  async yandexCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return this.handleOAuthCallback(getYandexConfig(), code, state, res);
  }

  // ==================== VK ====================

  @Get('vk')
  vkRedirect(@Res() res: Response) {
    const config = getVkConfig();
    const url = this.oauthService.buildAuthorizationUrl(config, this.baseUrl);
    return res.redirect(url);
  }

  @Get('vk/callback')
  async vkCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return this.handleOAuthCallback(getVkConfig(), code, state, res);
  }

  // ==================== TELEGRAM ====================

  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  async telegramAuth(@Body() dto: TelegramAuthDto) {
    this.telegramAuthService.verifyTelegramAuth(dto);

    const profile: OAuthNormalizedProfile = {
      providerId: String(dto.id),
      email: null,
      firstName: dto.first_name || null,
      lastName: dto.last_name || null,
      avatarUrl: dto.photo_url || null,
    };

    const user = await this.authService.findOrCreateOAuthUser(
      'telegram',
      profile,
    );

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Account is blocked');
    }

    const tokens = await this.authService.generateTokens(user);
    return {
      user: this.authService.toUserResponse(user),
      ...tokens,
    };
  }

  // ==================== SHARED HANDLER ====================

  private async handleOAuthCallback(
    config: OAuthProviderConfig,
    code: string,
    state: string,
    res: Response,
  ) {
    try {
      this.oauthService.verifyState(state);

      const tokenData = await this.oauthService.exchangeCodeForToken(
        config,
        code,
        this.baseUrl,
      );
      const accessToken = tokenData.access_token;

      const profile = await this.oauthService.fetchProfile(
        config,
        accessToken,
        tokenData,
      );

      const user = await this.authService.findOrCreateOAuthUser(
        config.provider,
        profile,
      );

      if (user.status === UserStatus.BLOCKED) {
        const redirectUrl = new URL(`${this.frontendUrl}/auth/callback`);
        redirectUrl.searchParams.set('error', 'account_blocked');
        return res.redirect(redirectUrl.toString());
      }

      const tokens = await this.authService.generateTokens(user);

      const redirectUrl = new URL(`${this.frontendUrl}/auth/callback`);
      redirectUrl.searchParams.set('accessToken', tokens.accessToken);
      redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
      return res.redirect(redirectUrl.toString());
    } catch (error) {
      const redirectUrl = new URL(`${this.frontendUrl}/auth/callback`);
      redirectUrl.searchParams.set('error', 'oauth_failed');
      return res.redirect(redirectUrl.toString());
    }
  }
}
