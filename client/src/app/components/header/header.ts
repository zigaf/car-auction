import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { StateService } from '../../core/services/state.service';
import { NotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';
import { AppButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, AppButtonComponent],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  menuOpen = signal(false);
  searchQuery = signal('');

  private readonly stateService = inject(StateService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);
  readonly ls = inject(LanguageService);
  private readonly destroy$ = new Subject<void>();

  appState$ = this.stateService.appState$;

  readonly cabinetNavItems = computed(() => [
    { path: '/cabinet', label: this.ls.t('cabinet.overview'), icon: 'dashboard', exact: true },
    { path: '/cabinet/bids', label: this.ls.t('cabinet.bids'), icon: 'gavel', exact: false },
    { path: '/cabinet/orders', label: this.ls.t('cabinet.orders'), icon: 'local_shipping', exact: false },
    { path: '/cabinet/documents', label: this.ls.t('cabinet.documents'), icon: 'description', exact: false },
    { path: '/cabinet/balance', label: this.ls.t('cabinet.balance'), icon: 'account_balance_wallet', exact: false },
    { path: '/cabinet/watchlist', label: this.ls.t('cabinet.watchlist'), icon: 'favorite', exact: false },
    { path: '/cabinet/calendar', label: this.ls.t('cabinet.calendar'), icon: 'calendar_month', exact: false },
    { path: '/cabinet/notifications', label: this.ls.t('cabinet.notifications'), icon: 'notifications', exact: false },
    { path: '/cabinet/calculator', label: this.ls.t('cabinet.calculator'), icon: 'calculate', exact: false },
    { path: '/cabinet/settings', label: this.ls.t('cabinet.settings'), icon: 'settings', exact: false },
  ]);

  ngOnInit(): void {
    this.appState$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) => a.isAuthenticated === b.isAuthenticated),
        filter((state) => state.isAuthenticated),
        switchMap(() => this.notificationService.getUnreadCount()),
      )
      .subscribe();

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

  search(): void {
    const q = this.searchQuery().trim();
    if (!q) return;
    this.router.navigate(['/catalog'], { queryParams: { q } });
    this.searchQuery.set('');
  }

  onFavoritesClick(): void {
    if (this.stateService.snapshot.isAuthenticated) {
      this.router.navigate(['/cabinet/watchlist']);
    } else {
      this.toastService.info(this.ls.t('toast.login.required'));
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
