export enum Role {
  CLIENT = 'client',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

export enum Language {
  RU = 'ru',
  UA = 'ua',
  EN = 'en',
}

export enum Currency {
  EUR = 'EUR',
  USD = 'USD',
  UAH = 'UAH',
}

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  googleId: string | null;
  yandexId: string | null;
  vkId: string | null;
  telegramId: string | null;
  avatarUrl: string | null;
  countryFlag: string;
  role: Role;
  status: UserStatus;
  isVerified: boolean;
  preferredLanguage: Language;
  preferredCurrency: Currency;
  referralCode: string;
  referredById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IUpdateProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  countryFlag?: string;
  preferredLanguage?: Language;
  preferredCurrency?: Currency;
}
