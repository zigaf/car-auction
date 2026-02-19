import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { BalanceService } from '../../../core/services/balance.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { StateService } from '../../../core/services/state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  private readonly balanceService = inject(BalanceService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly stateService = inject(StateService);

  balance = 0;
  activeBids = 0;
  favoritesCount = 0;
  pendingOrders = 0;
  notifications = 0;

  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.loading = true;
    this.error = '';

    // Load balance
    this.balanceService.getBalance().subscribe({
      next: (res) => {
        this.balance = res.balance;
        this.stateService.updateBalance(res.balance);
      },
      error: () => {
        this.error = 'Не удалось загрузить данные';
      },
    });

    // Load favorites count
    this.favoritesService.getFavorites(1, 1).subscribe({
      next: (res) => {
        this.favoritesCount = res.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });

    // Notifications from state
    this.notifications = this.stateService.snapshot.notifications;
  }
}
