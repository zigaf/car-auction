import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { WatchlistService } from '../../../core/services/watchlist.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { IWatchlistItem } from '../../../models/watchlist.model';
import { IFavorite } from '../../../models/favorite.model';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './watchlist.html',
  styleUrl: './watchlist.scss',
})
export class WatchlistComponent implements OnInit {
  private readonly watchlistService = inject(WatchlistService);
  private readonly favoritesService = inject(FavoritesService);

  watchlistItems: IWatchlistItem[] = [];
  favorites: IFavorite[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading = true;
    this.error = '';

    this.watchlistService.getWatchlist().subscribe({
      next: (items) => {
        this.watchlistItems = items;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить отслеживаемые';
        this.loading = false;
      },
    });

    this.favoritesService.getFavorites(1, 50).subscribe({
      next: (res) => {
        this.favorites = res.data;
      },
      error: () => {
        // silently fail favorites load
      },
    });
  }

  get brandWatchlist(): IWatchlistItem[] {
    return this.watchlistItems.filter(item => item.brand && !item.lotId);
  }

  get lotWatchlist(): IWatchlistItem[] {
    return this.watchlistItems.filter(item => item.lotId && item.lot);
  }

  removeBrand(id: string): void {
    this.watchlistService.removeFromWatchlist(id).subscribe({
      next: () => {
        this.watchlistItems = this.watchlistItems.filter(item => item.id !== id);
      },
    });
  }

  removeFavorite(lotId: string): void {
    this.favoritesService.removeFavorite(lotId).subscribe({
      next: () => {
        this.favorites = this.favorites.filter(f => f.lotId !== lotId);
      },
    });
  }

  removeWatchlistItem(id: string): void {
    this.watchlistService.removeFromWatchlist(id).subscribe({
      next: () => {
        this.watchlistItems = this.watchlistItems.filter(item => item.id !== id);
      },
    });
  }
}
