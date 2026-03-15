import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BalanceService } from '../../../core/services/balance.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AuctionService } from '../../../core/services/auction.service';
import { OrderService } from '../../../core/services/order.service';
import { DocumentsService } from '../../../core/services/documents.service';
import { UserService } from '../../../core/services/user.service';
import { StateService } from '../../../core/services/state.service';

interface OnboardingStep {
  label: string;
  icon: string;
  done: boolean;
  link?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly balanceService = inject(BalanceService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly auctionService = inject(AuctionService);
  private readonly orderService = inject(OrderService);
  private readonly documentsService = inject(DocumentsService);
  private readonly userService = inject(UserService);
  private readonly stateService = inject(StateService);
  private readonly destroy$ = new Subject<void>();

  balance = 0;
  activeBids = 0;
  favoritesCount = 0;
  pendingOrders = 0;

  loading = true;
  error = '';

  steps: OnboardingStep[] = [];
  onboardingComplete = false;

  get completedSteps(): number {
    return this.steps.filter((s) => s.done).length;
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.loading = true;
    this.error = '';

    forkJoin({
      balance: this.balanceService.getBalance(),
      favorites: this.favoritesService.getFavorites(1, 1),
      bids: this.auctionService.getMyBids(1, 1),
      orders: this.orderService.getMyOrders(1, 1),
      documents: this.documentsService.getDocuments(1, 1),
      profile: this.userService.getProfile(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ balance, favorites, bids, orders, documents, profile }) => {
          this.balance = balance.balance;
          this.stateService.updateBalance(balance.balance);
          this.favoritesCount = favorites.total;
          this.activeBids = bids.total;
          this.pendingOrders = orders.total;

          const isActive = profile.status === 'active';
          const isVerified = profile.isVerified;
          const hasBroker = !!profile.brokerId;
          const hasDocs = documents.total > 0;

          this.steps = [
            { label: 'Регистрация', icon: 'person_add', done: true },
            { label: 'Email подтверждён', icon: 'mark_email_read', done: isActive },
            { label: 'Документы загружены', icon: 'upload_file', done: hasDocs, link: '/cabinet/documents' },
            { label: 'KYC верификация', icon: 'verified_user', done: isVerified },
            { label: 'Брокер назначен', icon: 'handshake', done: hasBroker },
          ];

          this.onboardingComplete = this.steps.every((s) => s.done);
          this.loading = false;
        },
        error: () => {
          this.error = 'Не удалось загрузить данные';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
