import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WatchlistService } from '../../../core/services/watchlist.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { LotService } from '../../../core/services/lot.service';
import { IWatchlistItem } from '../../../models/watchlist.model';
import { IFavorite } from '../../../models/favorite.model';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [RouterLink, DecimalPipe, FormsModule],
  templateUrl: './watchlist.html',
  styleUrl: './watchlist.scss',
})
export class WatchlistComponent implements OnInit {
  private readonly watchlistService = inject(WatchlistService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly lotService = inject(LotService);

  watchlistItems: IWatchlistItem[] = [];
  favorites: IFavorite[] = [];
  loading = true;
  error = '';

  // Brand modal
  showBrandModal = false;
  brandSearch = '';
  allBrands: string[] = [];
  addingBrand = false;

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
        // silently fail
      },
    });
  }

  get brandWatchlist(): IWatchlistItem[] {
    return this.watchlistItems.filter(item => item.brand && !item.lotId);
  }

  get lotWatchlist(): IWatchlistItem[] {
    return this.watchlistItems.filter(item => item.lotId && item.lot);
  }

  get trackedBrandNames(): Set<string> {
    return new Set(this.brandWatchlist.map(item => item.brand!.toLowerCase()));
  }

  get filteredBrands(): string[] {
    const tracked = this.trackedBrandNames;
    const search = this.brandSearch.toLowerCase().trim();
    return this.allBrands.filter(
      b => !tracked.has(b.toLowerCase()) && (search === '' || b.toLowerCase().includes(search))
    );
  }

  openBrandModal(): void {
    this.showBrandModal = true;
    this.brandSearch = '';
    if (this.allBrands.length === 0) {
      this.lotService.getBrands().subscribe({
        next: (brands) => {
          this.allBrands = brands.map((b: any) => b.brand);
        },
      });
    }
  }

  closeBrandModal(): void {
    this.showBrandModal = false;
    this.brandSearch = '';
  }

  addBrand(brand: string): void {
    if (this.addingBrand) return;
    this.addingBrand = true;

    this.watchlistService.addToWatchlist({ brand }).subscribe({
      next: (item) => {
        this.watchlistItems = [...this.watchlistItems, item];
        this.addingBrand = false;
        this.closeBrandModal();
      },
      error: () => {
        this.addingBrand = false;
      },
    });
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
