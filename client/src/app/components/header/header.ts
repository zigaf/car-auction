import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, AsyncPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { StateService } from '../../core/services/state.service';
import { NotificationService } from '../../core/services/notification.service';
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
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  appState$ = this.stateService.appState$;

  ngOnInit(): void {
    this.appState$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) => a.isAuthenticated === b.isAuthenticated),
        filter((state) => state.isAuthenticated),
        switchMap(() => this.notificationService.getUnreadCount()),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
