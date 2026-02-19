import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { ILot, ILotFilter } from '../../models/lot.model';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class CatalogComponent implements OnInit {
  private readonly lotService = inject(LotService);

  showAdvancedFilters = false;
  viewMode: 'grid' | 'list' = 'grid';
  sortBy = 'date_desc';
  loading = false;
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

  ngOnInit(): void {
    this.loadBrands();
    this.loadLots();
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
      },
      error: () => {
        this.lots = [];
        this.totalLots = 0;
        this.loading = false;
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
}
