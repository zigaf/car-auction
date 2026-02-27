import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BalanceService } from '../../../core/services/balance.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AuctionService } from '../../../core/services/auction.service';
import { OrderService } from '../../../core/services/order.service';
import { StateService } from '../../../core/services/state.service';

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
  private readonly stateService = inject(StateService);
  private readonly destroy$ = new Subject<void>();

  balance = 0;
  activeBids = 0;
  favoritesCount = 0;
  pendingOrders = 0;

  loading = true;
  error = '';

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
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ balance, favorites, bids, orders }) => {
          this.balance = balance.balance;
          this.stateService.updateBalance(balance.balance);
          this.favoritesCount = favorites.total;
          this.activeBids = bids.total;
          this.pendingOrders = orders.total;
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
