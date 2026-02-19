import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { ILot, ILotStats, IBrandCount } from '../../models/lot.model';
import { AppBrandIconComponent } from '../../shared/components/brand-icon/brand-icon.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DecimalPipe, AppBrandIconComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnInit {
  private readonly lotService = inject(LotService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  lots: ILot[] = [];
  recentLots: ILot[] = [];
  brands: IBrandCount[] = [];
  stats: ILotStats = { totalLots: 0, totalBrands: 0, countries: 0, withPhotos: 0 };

  scraperLoading = false;
  scraperMessage = '';
  scraperStatus: 'idle' | 'success' | 'error' = 'idle';

  steps = [
    { title: 'Регистрация', desc: 'Создайте аккаунт и пройдите верификацию' },
    { title: 'Пополните баланс', desc: 'Внесите депозит для участия в торгах' },
    { title: 'Выберите авто', desc: 'Найдите автомобиль в каталоге или на live-торгах' },
    { title: 'Сделайте ставку', desc: 'Участвуйте в аукционе в реальном времени' },
    { title: 'Оплатите лот', desc: 'После победы оплатите автомобиль' },
    { title: 'Доставка и растаможка', desc: 'Мы доставим и растаможим авто для вас' },
    { title: 'Получите авто', desc: 'Заберите автомобиль по вашему адресу' },
  ];

  popularTags = ['Porsche 911', 'BMW M3', 'Mercedes W124', 'Land Cruiser', 'Ferrari'];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;

    forkJoin({
      lots: this.lotService.getAll({ limit: 6, sort: 'price_desc' }),
      recentLots: this.lotService.getAll({ limit: 6, sort: 'date_desc' }),
      brands: this.lotService.getBrands(),
      stats: this.lotService.getStats(),
    }).subscribe({
      next: (result) => {
        this.lots = result.lots.data || [];
        this.recentLots = result.recentLots.data || [];
        this.brands = result.brands || [];
        this.stats = result.stats;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getMainImage(lot: ILot): string | null {
    if (lot.images && lot.images.length > 0) {
      const main = lot.images.find((img) => img.category === 'main');
      const img = main || lot.images[0];
      return this.getImageUrl(img.url);
    }
    // Fallback to source image URL
    if (lot.sourceImageUrl) {
      return lot.sourceImageUrl.startsWith('//')
        ? 'https:' + lot.sourceImageUrl
        : lot.sourceImageUrl;
    }
    return null;
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl.replace('/api', '')}${path}`;
  }

  async startScraper(): Promise<void> {
    this.scraperLoading = true;
    this.scraperMessage = '';
    this.scraperStatus = 'idle';
    this.cdr.detectChanges();
    try {
      const resp = await fetch(`${environment.apiUrl}/scraper/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPages: 2 }),
      });
      const data = await resp.json();
      if (resp.ok) {
        this.scraperStatus = 'success';
        this.scraperMessage = `Парсер запущен! Найдено: ${data.lotsFound ?? '\u{2014}'}, создано: ${data.lotsCreated ?? '\u{2014}'}, обновлено: ${data.lotsUpdated ?? '\u{2014}'}`;
        this.loadData();
      } else {
        this.scraperStatus = 'error';
        this.scraperMessage = data.message || 'Ошибка запуска парсера';
      }
    } catch {
      this.scraperStatus = 'error';
      this.scraperMessage = 'Не удалось подключиться к серверу';
    } finally {
      this.scraperLoading = false;
      this.cdr.detectChanges();
    }
  }

  getFuelLabel(fuelType: string): string {
    const labels: Record<string, string> = {
      petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид',
      electric: 'Электро', lpg: 'Газ', other: 'Другое',
    };
    return labels[fuelType] || fuelType || '-';
  }
}
