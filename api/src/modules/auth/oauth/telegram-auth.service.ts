import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Injectable()
export class TelegramAuthService {
  verifyTelegramAuth(data: TelegramAuthDto): void {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const authDate = Number(data.auth_date);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 300) {
      throw new UnauthorizedException('Telegram auth data expired');
    }

    const { hash, ...rest } = data;
    const checkString = Object.keys(rest)
      .sort()
      .filter(
        (key) =>
          rest[key as keyof typeof rest] !== undefined &&
          rest[key as keyof typeof rest] !== null,
      )
      .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
      .join('\n');

    const secretKey = createHash('sha256').update(botToken).digest();
    const hmac = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    if (hmac !== hash) {
      throw new UnauthorizedException('Invalid Telegram auth data');
    }
  }
}
