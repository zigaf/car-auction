import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  NotificationService,
  INotification,
  NotificationType,
} from '../../../core/services/notification.service';

const TYPE_ICONS: Record<NotificationType, string> = {
  outbid: 'gavel',
  auction_starting: 'timer',
  auction_ended: 'flag',
  order_status: 'local_shipping',
  document: 'description',
  new_lot_match: 'search',
  balance_changed: 'account_balance_wallet',
  action_required: 'warning',
};

const TYPE_ICON_CLASS: Record<NotificationType, string> = {
  outbid: 'notif-item__icon--bid',
  auction_starting: 'notif-item__icon--bid',
  auction_ended: 'notif-item__icon--bid',
  order_status: 'notif-item__icon--order',
  document: 'notif-item__icon--document',
  new_lot_match: 'notif-item__icon--system',
  balance_changed: 'notif-item__icon--balance',
  action_required: 'notif-item__icon--system',
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly destroy$ = new Subject<void>();

  notifications: INotification[] = [];
  loading = true;
  error = '';
  total = 0;
  unreadCount = 0;
  page = 1;
  limit = 20;
  markingAll = false;

  readonly typeIcons = TYPE_ICONS;
  readonly typeIconClass = TYPE_ICON_CLASS;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.notificationService
      .getNotifications({ page: this.page, limit: this.limit })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.notifications = res.data;
          this.total = res.total;
          this.unreadCount = res.unreadCount;
          this.loading = false;
        },
        error: () => {
          this.error = 'Не удалось загрузить уведомления';
          this.loading = false;
        },
      });
  }

  markRead(notification: INotification): void {
    if (notification.isRead) return;

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        notification.isRead = true;
        if (this.unreadCount > 0) this.unreadCount--;
      },
    });
  }

  markAllRead(): void {
    if (this.markingAll || this.unreadCount === 0) return;
    this.markingAll = true;

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.forEach((n) => (n.isRead = true));
        this.unreadCount = 0;
        this.markingAll = false;
      },
      error: () => { this.markingAll = false; },
    });
  }

  deleteNotification(id: string, event: Event): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(id).subscribe({
      next: () => {
        const idx = this.notifications.findIndex((n) => n.id === id);
        if (idx !== -1) {
          if (!this.notifications[idx].isRead && this.unreadCount > 0) {
            this.unreadCount--;
          }
          this.notifications.splice(idx, 1);
          this.total--;
        }
      },
    });
  }

  prevPage(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  nextPage(): void {
    if (this.page * this.limit < this.total) { this.page++; this.load(); }
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.limit);
  }
}
