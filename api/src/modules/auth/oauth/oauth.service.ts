import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { OAuthProviderConfig } from './interfaces/oauth-provider-config.interface';
import { OAuthNormalizedProfile } from './interfaces/oauth-profile.interface';

@Injectable()
export class OAuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
  ) {}

  buildAuthorizationUrl(
    config: OAuthProviderConfig,
    baseUrl: string,
  ): string {
    const state = this.jwtService.sign(
      {
        nonce: randomBytes(16).toString('hex'),
        provider: config.provider,
      },
      {
        secret: process.env.OAUTH_STATE_SECRET || 'oauth-state-secret',
        expiresIn: '10m' as any,
      },
    );

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${baseUrl}${config.callbackPath}`,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  verifyState(state: string): { provider: string; nonce: string } {
    return this.jwtService.verify(state, {
      secret: process.env.OAUTH_STATE_SECRET || 'oauth-state-secret',
    });
  }

  async exchangeCodeForToken(
    config: OAuthProviderConfig,
    code: string,
    baseUrl: string,
  ): Promise<Record<string, any>> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: `${baseUrl}${config.callbackPath}`,
      grant_type: 'authorization_code',
    });

    const { data } = await firstValueFrom(
      this.httpService.post(config.tokenUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    return data;
  }

  async fetchProfile(
    config: OAuthProviderConfig,
    accessToken: string,
    tokenData?: Record<string, any>,
  ): Promise<OAuthNormalizedProfile> {
    switch (config.provider) {
      case 'google':
        return this.fetchGoogleProfile(config, accessToken);
      case 'yandex':
        return this.fetchYandexProfile(config, accessToken);
      case 'vk':
        return this.fetchVkProfile(config, accessToken, tokenData);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  private async fetchGoogleProfile(
    config: OAuthProviderConfig,
    accessToken: string,
  ): Promise<OAuthNormalizedProfile> {
    const { data } = await firstValueFrom(
      this.httpService.get(config.profileUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return {
      providerId: String(data.id),
      email: data.email || null,
      firstName: data.given_name || null,
      lastName: data.family_name || null,
      avatarUrl: data.picture || null,
    };
  }

  private async fetchYandexProfile(
    config: OAuthProviderConfig,
    accessToken: string,
  ): Promise<OAuthNormalizedProfile> {
    const { data } = await firstValueFrom(
      this.httpService.get(config.profileUrl, {
        headers: { Authorization: `OAuth ${accessToken}` },
      }),
    );
    return {
      providerId: String(data.id),
      email: data.default_email || null,
      firstName: data.first_name || null,
      lastName: data.last_name || null,
      avatarUrl: data.default_avatar_id
        ? `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`
        : null,
    };
  }

  private async fetchVkProfile(
    config: OAuthProviderConfig,
    accessToken: string,
    tokenData?: Record<string, any>,
  ): Promise<OAuthNormalizedProfile> {
    const params = new URLSearchParams({
      access_token: accessToken,
      ...(config.profileParams || {}),
    });
    const { data } = await firstValueFrom(
      this.httpService.get(`${config.profileUrl}?${params.toString()}`),
    );
    const user = data.response?.[0];
    return {
      providerId: String(user?.id),
      email: tokenData?.email || null,
      firstName: user?.first_name || null,
      lastName: user?.last_name || null,
      avatarUrl: user?.photo_200 || null,
    };
  }
}
