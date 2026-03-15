import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { BrokerService } from '../../../core/services/broker.service';
import { LotService } from '../../../core/services/lot.service';
import { StateService } from '../../../core/services/state.service';
import { IUser } from '../../../models/user.model';
import { IFavorite } from '../../../models/favorite.model';
import { ILot } from '../../../models/lot.model';

@Component({
  selector: 'app-traders',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './traders.html',
  styleUrl: './traders.scss',
})
export class TradersComponent implements OnInit {
  private readonly brokerService = inject(BrokerService);
  private readonly lotService = inject(LotService);
  private readonly stateService = inject(StateService);

  traders: IUser[] = [];
  loading = true;
  error = '';

  selectedTrader: IUser | null = null;
  traderFavorites: IFavorite[] = [];
  favoritesLoading = false;

  // Add to favorites modal
  showAddModal = false;
  searchQuery = '';
  searchResults: ILot[] = [];
  searching = false;

  ngOnInit(): void {
    this.loadTraders();
  }

  private loadTraders(): void {
    this.loading = true;
    this.error = '';

    this.brokerService.getMyTraders().subscribe({
      next: (traders) => {
        this.traders = traders;
        this.loading = false;
        if (traders.length > 0) {
          this.selectTrader(traders[0]);
        }
      },
      error: () => {
        this.error = 'Не удалось загрузить список трейдеров';
        this.loading = false;
      },
    });
  }

  selectTrader(trader: IUser): void {
    this.selectedTrader = trader;
    this.loadTraderFavorites(trader.id);
  }

  private loadTraderFavorites(traderId: string): void {
    this.favoritesLoading = true;
    this.brokerService.getTraderFavorites(traderId, 1, 50).subscribe({
      next: (res) => {
        this.traderFavorites = res.data;
        this.favoritesLoading = false;
      },
      error: () => {
        this.traderFavorites = [];
        this.favoritesLoading = false;
      },
    });
  }

  removeFavorite(lotId: string): void {
    if (!this.selectedTrader) return;
    this.brokerService.removeFromTraderFavorite(this.selectedTrader.id, lotId).subscribe({
      next: () => {
        this.traderFavorites = this.traderFavorites.filter(f => f.lotId !== lotId);
      },
    });
  }

  openAddModal(): void {
    this.showAddModal = true;
    this.searchQuery = '';
    this.searchResults = [];
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.searchQuery = '';
    this.searchResults = [];
  }

  searchLots(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }
    this.searching = true;
    this.lotService.getAll({ search: this.searchQuery, limit: 10 }).subscribe({
      next: (res) => {
        const existingIds = new Set(this.traderFavorites.map(f => f.lotId));
        this.searchResults = res.data.filter((lot: ILot) => !existingIds.has(lot.id));
        this.searching = false;
      },
      error: () => {
        this.searching = false;
      },
    });
  }

  addToFavorites(lot: ILot): void {
    if (!this.selectedTrader) return;
    this.brokerService.addToTraderFavorite(this.selectedTrader.id, lot.id).subscribe({
      next: (fav) => {
        this.traderFavorites = [...this.traderFavorites, fav];
        this.searchResults = this.searchResults.filter(l => l.id !== lot.id);
      },
    });
  }

  getTraderInitials(trader: IUser): string {
    const f = trader.firstName?.[0] || '';
    const l = trader.lastName?.[0] || '';
    return (f + l).toUpperCase() || '?';
  }

  getTraderDisplayName(trader: IUser): string {
    return [trader.firstName, trader.lastName].filter(Boolean).join(' ') || trader.email;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Активен',
      pending: 'Ожидает',
      blocked: 'Заблокирован',
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      active: 'status--active',
      pending: 'status--pending',
      blocked: 'status--blocked',
    };
    return map[status] || '';
  }
}
