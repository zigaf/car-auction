import { Component, inject, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { AuctionStateService } from '../../core/services/auction-state.service';
import { ILot, ILotFilter, LotStatus } from '../../models/lot.model';
import { AppBrandIconComponent } from '../../shared/components/brand-icon/brand-icon.component';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, AppBrandIconComponent],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class CatalogComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly lotService = inject(LotService);
  private readonly auctionState = inject(AuctionStateService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroy$ = new Subject<void>();
  private observer: IntersectionObserver | null = null;

  @ViewChild('scrollAnchor') scrollAnchor!: ElementRef<HTMLDivElement>;

  showAdvancedFilters = false;
  viewMode: 'grid' | 'list' = 'grid';
  sortBy = 'date_desc';
  loading = false;
  loadingMore = false;
  totalLots = 0;
  currentPage = 1;

  filters = {
    brand: '',
    yearFrom: null as number | null,
    yearTo: null as number | null,
    priceFrom: null as number | null,
    priceTo: null as number | null,
    fuelType: '',
    mileageFrom: null as number | null,
    mileageTo: null as number | null,
    search: '',
  };

  sortOptions = [
    { value: 'date_desc', label: 'Новые' },
    { value: 'price_asc', label: 'Цена ↑' },
    { value: 'price_desc', label: 'Цена ↓' },
    { value: 'year_desc', label: 'Год ↓' },
    { value: 'mileage_asc', label: 'Пробег ↑' },
  ];

  brands: string[] = [];
  fuelTypes = ['petrol', 'diesel', 'hybrid', 'electric', 'lpg', 'other'];
  fuelTypeLabels: Record<string, string> = {
    petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид',
    electric: 'Электро', lpg: 'Газ', other: 'Другое',
  };

  lots: ILot[] = [];

  get hasMore(): boolean {
    return this.lots.length < this.totalLots;
  }

  ngOnInit(): void {
    this.loadBrands();
    this.loadLots();

    // Reactively patch lot prices when WebSocket bid events arrive
    this.auctionState.priceUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        const lot = this.lots.find((l) => l.id === update.lotId);
        if (lot) {
          lot.currentPrice = update.currentPrice;
          if (update.auctionEndAt !== undefined) {
            lot.auctionEndAt = update.auctionEndAt;
          }
        }
      });
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupIntersectionObserver(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && this.hasMore && !this.loading && !this.loadingMore) {
          this.loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    if (this.scrollAnchor?.nativeElement) {
      this.observer.observe(this.scrollAnchor.nativeElement);
    }
  }

  loadBrands(): void {
    this.lotService.getBrands().subscribe({
      next: (data) => {
        this.brands = data.map((b) => b.brand).filter(Boolean);
      },
      error: () => { /* keep empty */ },
    });
  }

  loadLots(): void {
    this.loading = true;

    const filter: ILotFilter = {
      page: this.currentPage,
      limit: 20,
      sort: this.sortBy || undefined,
      brand: this.filters.brand || undefined,
      fuelType: this.filters.fuelType || undefined,
      yearFrom: this.filters.yearFrom ?? undefined,
      yearTo: this.filters.yearTo ?? undefined,
      priceFrom: this.filters.priceFrom ?? undefined,
      priceTo: this.filters.priceTo ?? undefined,
      mileageFrom: this.filters.mileageFrom ?? undefined,
      mileageTo: this.filters.mileageTo ?? undefined,
      search: this.filters.search || undefined,
    };

    this.lotService.getAll(filter).subscribe({
      next: (result) => {
        this.lots = result.data;
        this.totalLots = result.total;
        this.loading = false;
        // Pre-populate global state; WebSocket will override with live values
        this.auctionState.seedFromLots(result.data);
      },
      error: () => {
        this.lots = [];
        this.totalLots = 0;
        this.loading = false;
      },
    });
  }

  loadMore(): void {
    if (!this.hasMore || this.loadingMore) return;
    this.loadingMore = true;
    this.currentPage++;

    const filter: ILotFilter = {
      page: this.currentPage,
      limit: 20,
      sort: this.sortBy || undefined,
      brand: this.filters.brand || undefined,
      fuelType: this.filters.fuelType || undefined,
      yearFrom: this.filters.yearFrom ?? undefined,
      yearTo: this.filters.yearTo ?? undefined,
      priceFrom: this.filters.priceFrom ?? undefined,
      priceTo: this.filters.priceTo ?? undefined,
      mileageFrom: this.filters.mileageFrom ?? undefined,
      mileageTo: this.filters.mileageTo ?? undefined,
      search: this.filters.search || undefined,
    };

    this.lotService.getAll(filter).subscribe({
      next: (result) => {
        this.lots = [...this.lots, ...result.data];
        this.totalLots = result.total;
        this.loadingMore = false;
        this.auctionState.seedFromLots(result.data);
      },
      error: () => {
        this.loadingMore = false;
      },
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadLots();
  }

  getMainImage(lot: ILot): string | null {
    if (lot.images && lot.images.length > 0) {
      const main = lot.images.find((img) => img.category === 'main');
      const img = main || lot.images[0];
      return this.getImageUrl(img.url);
    }
    if (lot.sourceImageUrl) {
      return lot.sourceImageUrl.startsWith('//') ? 'https:' + lot.sourceImageUrl : lot.sourceImageUrl;
    }
    return null;
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl.replace('/api', '')}${path}`;
  }

  getFuelLabel(fuelType: string | null): string {
    if (!fuelType) return '-';
    return this.fuelTypeLabels[fuelType] || fuelType || '-';
  }

  resetFilters(): void {
    this.filters = {
      brand: '', yearFrom: null, yearTo: null,
      priceFrom: null, priceTo: null, fuelType: '',
      mileageFrom: null, mileageTo: null, search: '',
    };
    this.currentPage = 1;
    this.loadLots();
  }

  // ─── Real-time helpers ────────────────────────────────────────────────────

  /** True when the lot is actively trading (live auction in progress). */
  isLiveLot(lot: ILot): boolean {
    return lot.status === LotStatus.TRADING;
  }

  /**
   * Returns the most up-to-date price for a lot.
   * Prefers the live WebSocket value; falls back to the HTTP snapshot.
   */
  getLivePrice(lot: ILot): number {
    const livePrice = this.auctionState.getLotPrice(lot.id);
    if (livePrice !== null) return livePrice;
    if (lot.currentPrice) return parseFloat(String(lot.currentPrice));
    if (lot.startingBid) return parseFloat(String(lot.startingBid));
    return 0;
  }
}
