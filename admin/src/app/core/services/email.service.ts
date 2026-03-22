import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface EmailSetting {
  eventType: string;
  isEnabled: boolean;
}

export interface EmailTemplate {
  id: string;
  eventType: string;
  language: string;
  subject: string;
  bodyHtml: string;
}

export const EVENT_LABELS: Record<string, string> = {
  EMAIL_VERIFICATION: 'Подтверждение email',
  PASSWORD_RESET: 'Сброс пароля',
  AUCTION_WON: 'Победа в аукционе',
  AUCTION_STARTING: 'Аукцион начинается',
  ORDER_STATUS_CHANGED: 'Изменение статуса заказа',
  BALANCE_TOPPED_UP: 'Пополнение баланса',
  BALANCE_WITHDRAWN: 'Списание баланса',
  CUSTOM: 'Кастомное письмо',
};

export const EVENT_VARIABLES: Record<string, string[]> = {
  EMAIL_VERIFICATION: ['firstName', 'verificationLink'],
  PASSWORD_RESET: ['firstName', 'resetLink'],
  AUCTION_WON: ['firstName', 'lotTitle', 'finalPrice'],
  AUCTION_STARTING: ['firstName', 'lotTitle', 'auctionStartTime', 'lotLink'],
  ORDER_STATUS_CHANGED: ['firstName', 'orderId', 'statusLabel'],
  BALANCE_TOPPED_UP: ['firstName', 'amount', 'currency', 'newBalance'],
  BALANCE_WITHDRAWN: ['firstName', 'amount', 'currency', 'newBalance'],
  CUSTOM: ['firstName', 'subject', 'message'],
};

@Injectable({ providedIn: 'root' })
export class EmailAdminService {
  constructor(private readonly api: ApiService) {}

  getSettings(): Observable<EmailSetting[]> {
    return this.api.get<EmailSetting[]>('/email/settings');
  }

  toggleSetting(eventType: string, isEnabled: boolean): Observable<EmailSetting> {
    return this.api.patch<EmailSetting>(`/email/settings/${eventType}`, { isEnabled });
  }

  getTemplates(eventType: string): Observable<EmailTemplate[]> {
    return this.api.get<EmailTemplate[]>(`/email/templates/${eventType}`);
  }

  upsertTemplate(eventType: string, language: string, subject: string, bodyHtml: string): Observable<EmailTemplate> {
    return this.api.put<EmailTemplate>(`/email/templates/${eventType}/${language}`, { subject, bodyHtml });
  }

  deleteTemplate(eventType: string, language: string): Observable<void> {
    return this.api.delete<void>(`/email/templates/${eventType}/${language}`);
  }

  preview(eventType: string, subject: string, bodyHtml: string): Observable<{ html: string }> {
    return this.api.post<{ html: string }>(`/email/templates/${eventType}/preview`, { subject, bodyHtml });
  }
}
