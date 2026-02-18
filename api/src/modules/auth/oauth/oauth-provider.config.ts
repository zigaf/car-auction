import { OAuthProviderConfig } from './interfaces/oauth-provider-config.interface';

export function getGoogleConfig(): OAuthProviderConfig {
  return {
    provider: 'google',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'profile', 'email'],
    callbackPath: '/api/auth/google/callback',
  };
}

export function getYandexConfig(): OAuthProviderConfig {
  return {
    provider: 'yandex',
    clientId: process.env.YANDEX_CLIENT_ID || '',
    clientSecret: process.env.YANDEX_CLIENT_SECRET || '',
    authUrl: 'https://oauth.yandex.ru/authorize',
    tokenUrl: 'https://oauth.yandex.ru/token',
    profileUrl: 'https://login.yandex.ru/info?format=json',
    scopes: ['login:email', 'login:info'],
    callbackPath: '/api/auth/yandex/callback',
  };
}

export function getVkConfig(): OAuthProviderConfig {
  return {
    provider: 'vk',
    clientId: process.env.VK_CLIENT_ID || '',
    clientSecret: process.env.VK_CLIENT_SECRET || '',
    authUrl: 'https://oauth.vk.com/authorize',
    tokenUrl: 'https://oauth.vk.com/access_token',
    profileUrl: 'https://api.vk.com/method/users.get',
    scopes: ['email'],
    callbackPath: '/api/auth/vk/callback',
    profileParams: { v: '5.199', fields: 'photo_200' },
  };
}
