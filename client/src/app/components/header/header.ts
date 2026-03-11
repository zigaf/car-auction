import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule, AsyncPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { StateService } from '../../core/services/state.service';
import { NotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';
import { AppButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, RouterLinkActive, AppButtonComponent],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  menuOpen = signal(false);

  private readonly stateService = inject(StateService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  appState$ = this.stateService.appState$;

  cabinetNavItems = [
    { path: '/cabinet', label: 'Обзор', icon: 'dashboard', exact: true },
    { path: '/cabinet/bids', label: 'Мои ставки', icon: 'gavel', exact: false },
    { path: '/cabinet/orders', label: 'Заказы', icon: 'local_shipping', exact: false },
    { path: '/cabinet/documents', label: 'Документы', icon: 'description', exact: false },
    { path: '/cabinet/balance', label: 'Баланс', icon: 'account_balance_wallet', exact: false },
    { path: '/cabinet/watchlist', label: 'Отслеживаемые', icon: 'favorite', exact: false },
    { path: '/cabinet/calendar', label: 'Календарь', icon: 'calendar_month', exact: false },
    { path: '/cabinet/notifications', label: 'Уведомления', icon: 'notifications', exact: false },
    { path: '/cabinet/calculator', label: 'Калькулятор', icon: 'calculate', exact: false },
    { path: '/cabinet/settings', label: 'Настройки', icon: 'settings', exact: false },
  ];

  ngOnInit(): void {
    this.appState$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) => a.isAuthenticated === b.isAuthenticated),
        filter((state) => state.isAuthenticated),
        switchMap(() => this.notificationService.getUnreadCount()),
      )
      .subscribe();

    // Close drawer on route navigation
    this.router.events
      .pipe(
        takeUntil(this.destroy$),
        filter((e) => e instanceof NavigationEnd),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFavoritesClick(): void {
    if (this.stateService.snapshot.isAuthenticated) {
      this.router.navigate(['/cabinet/watchlist']);
    } else {
      this.toastService.info('Войдите в аккаунт, чтобы увидеть избранное');
    }
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.stateService.clearUser();
    this.router.navigate(['/login']);
    this.menuOpen.set(false);
  }
}
