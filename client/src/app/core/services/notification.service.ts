import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StateService } from './state.service';

export type NotificationType =
  | 'outbid'
  | 'auction_starting'
  | 'auction_ended'
  | 'order_status'
  | 'document'
  | 'new_lot_match'
  | 'balance_changed'
  | 'action_required';

export interface INotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface INotificationsResponse {
  data: INotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(
    private readonly api: ApiService,
    private readonly stateService: StateService,
  ) {}

  getNotifications(params: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Observable<INotificationsResponse> {
    return this.api.get<INotificationsResponse>('/notifications', {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      unreadOnly: params.unreadOnly,
    }).pipe(
      tap((res) => {
        this.stateService.setNotifications(res.unreadCount);
      }),
    );
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.api.get<{ count: number }>('/notifications/unread-count').pipe(
      tap((res) => {
        this.stateService.setNotifications(res.count);
      }),
    );
  }

  markAsRead(id: string): Observable<void> {
    return this.api.patch<void>(`/notifications/${id}/read`);
  }

  markAllAsRead(): Observable<void> {
    return this.api.patch<void>('/notifications/read-all').pipe(
      tap(() => this.stateService.setNotifications(0)),
    );
  }

  deleteNotification(id: string): Observable<void> {
    return this.api.delete<void>(`/notifications/${id}`);
  }
}
