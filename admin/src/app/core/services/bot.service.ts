import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type BotPattern = 'AGGRESSIVE' | 'STEADY' | 'SNIPER' | 'RANDOM';

export interface IBotUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  countryFlag: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
}

export interface IBotConfig {
  id: string;
  lotId: string;
  lot?: { id: string; title: string };
  botUserId: string;
  botUser?: IBotUser;
  maxPrice: number;
  pattern: BotPattern;
  isActive: boolean;
  minDelaySec: number;
  maxDelaySec: number;
  createdAt: string;
}

export interface CreateBotUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  countryFlag?: string;
  avatarUrl?: string;
}

export interface CreateBotConfigPayload {
  lotId: string;
  botUserId: string;
  maxPrice: number;
  pattern: BotPattern;
  isActive?: boolean;
  minDelaySec?: number;
  maxDelaySec?: number;
}

export interface UpdateBotConfigPayload {
  maxPrice?: number;
  pattern?: BotPattern;
  isActive?: boolean;
  minDelaySec?: number;
  maxDelaySec?: number;
}

@Injectable({ providedIn: 'root' })
export class BotService {
  constructor(private readonly api: ApiService) {}

  // ─── Bot Users ──────────────────────────────────────────────────────────────

  createBotUser(payload: CreateBotUserPayload): Observable<IBotUser> {
    return this.api.post<IBotUser>('/bots/users', payload);
  }

  getBotUsers(): Observable<IBotUser[]> {
    return this.api.get<IBotUser[]>('/bots/users');
  }

  deleteBotUser(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/bots/users/${id}`);
  }

  // ─── Bot Configs ─────────────────────────────────────────────────────────────

  createConfig(payload: CreateBotConfigPayload): Observable<IBotConfig> {
    return this.api.post<IBotConfig>('/bots/configs', payload);
  }

  getConfigs(lotId?: string): Observable<IBotConfig[]> {
    return this.api.get<IBotConfig[]>('/bots/configs', { lotId });
  }

  updateConfig(id: string, payload: UpdateBotConfigPayload): Observable<IBotConfig> {
    return this.api.patch<IBotConfig>(`/bots/configs/${id}`, payload);
  }

  deleteConfig(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/bots/configs/${id}`);
  }
}
