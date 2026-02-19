import { Component, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class CatalogComponent {
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

  lots: any[] = [];

  constructor(private cdr: ChangeDetectorRef) {
    afterNextRender(() => {
      this.loadBrands();
      this.loadLots();
    });
  }

  async loadBrands(): Promise<void> {
    try {
      const resp = await fetch(`${environment.apiUrl}/lots/brands`);
      if (resp.ok) {
        const data = await resp.json();
        this.brands = data.map((b: any) => b.brand).filter(Boolean);
        this.cdr.detectChanges();
      }
    } catch { /* keep empty */ }
  }

  async loadLots(): Promise<void> {
    this.loading = true;
    try {
      const params = new URLSearchParams();
      params.set('page', String(this.currentPage));
      params.set('limit', '20');
      if (this.sortBy) params.set('sort', this.sortBy);
      if (this.filters.brand) params.set('brand', this.filters.brand);
      if (this.filters.fuelType) params.set('fuelType', this.filters.fuelType);
      if (this.filters.yearFrom) params.set('yearFrom', String(this.filters.yearFrom));
      if (this.filters.yearTo) params.set('yearTo', String(this.filters.yearTo));
      if (this.filters.priceFrom) params.set('priceFrom', String(this.filters.priceFrom));
      if (this.filters.priceTo) params.set('priceTo', String(this.filters.priceTo));
      if (this.filters.mileageFrom) params.set('mileageFrom', String(this.filters.mileageFrom));
      if (this.filters.mileageTo) params.set('mileageTo', String(this.filters.mileageTo));
      if (this.filters.search) params.set('search', this.filters.search);

      const resp = await fetch(`${environment.apiUrl}/lots?${params}`);
      if (!resp.ok) throw new Error('Failed');
      const result = await resp.json();
      this.lots = result.data;
      this.totalLots = result.total;
    } catch {
      this.lots = [];
      this.totalLots = 0;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadLots();
  }

  getMainImage(lot: any): string | null {
    if (lot.images && lot.images.length > 0) {
      const main = lot.images.find((img: any) => img.category === 'main');
      const img = main || lot.images[0];
      return this.getImageUrl(img.url);
    }
    if (lot.bcaImageUrl) {
      return lot.bcaImageUrl.startsWith('//') ? 'https:' + lot.bcaImageUrl : lot.bcaImageUrl;
    }
    return null;
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl.replace('/api', '')}${path}`;
  }

  getFuelLabel(fuelType: string): string {
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
