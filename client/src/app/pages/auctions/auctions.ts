import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Subject, takeUntil, timer, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { ILot, ImageCategory, LotStatus } from '../../models/lot.model';

interface DayGroup {
  date: Date;
  label: string;
  lots: ILot[];
}

@Component({
  selector: 'app-auctions',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe],
  templateUrl: './auctions.html',
  styleUrl: './auctions.scss',
})
export class AuctionsComponent implements OnInit, OnDestroy {
  private readonly lotService = inject(LotService);
  private readonly destroy$ = new Subject<void>();

  loading = true;
  liveLots: ILot[] = [];
  dayGroups: DayGroup[] = [];
  totalLots = 0;

  ngOnInit(): void {
    this.loadAuctions();

    // Update countdowns every second
    timer(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAuctions(): void {
    this.loading = true;

    const now = new Date();
    const dateFrom = now.toISOString();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 3);
    endDate.setHours(23, 59, 59, 999);
    const dateTo = endDate.toISOString();

    forkJoin({
      live: this.lotService.getAll({ status: LotStatus.TRADING, limit: 50 }),
      upcoming: this.lotService.getAll({ dateFrom, dateTo, limit: 200, sort: 'auction_asc' }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ live, upcoming }) => {
          this.liveLots = live.data || [];
          this.totalLots = (live.total || 0) + (upcoming.total || 0);
          this.dayGroups = this.groupByDay(upcoming.data || []);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  private groupByDay(lots: ILot[]): DayGroup[] {
    const groups = new Map<string, DayGroup>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    for (const lot of lots) {
      const auctionDate = new Date(lot.auctionStartAt || lot.auctionEndAt || lot.createdAt);
      const dateKey = auctionDate.toISOString().split('T')[0];

      if (!groups.has(dateKey)) {
        const lotDay = new Date(dateKey + 'T00:00:00');
        let label: string;

        if (lotDay.getTime() === today.getTime()) {
          label = 'Сегодня';
        } else if (lotDay.getTime() === tomorrow.getTime()) {
          label = 'Завтра';
        } else {
          label = this.formatDateLabel(lotDay);
        }

        groups.set(dateKey, { date: lotDay, label, lots: [] });
      }

      groups.get(dateKey)!.lots.push(lot);
    }

    return Array.from(groups.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }

  private formatDateLabel(date: Date): string {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  }

  getMainImage(lot: ILot): string | null {
    if (lot.images && lot.images.length > 0) {
      const main = lot.images.find((img) => img.category === ImageCategory.MAIN);
      const img = main || lot.images[0];
      return this.getImageUrl(img.url);
    }
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

  getCountdown(lot: ILot): string {
    const target = lot.auctionStartAt || lot.auctionEndAt;
    if (!target) return '';

    const now = Date.now();
    const end = new Date(target).getTime();
    const diff = end - now;

    if (diff <= 0) {
      // If auction has started, show time until end
      if (lot.auctionEndAt && lot.auctionStartAt) {
        const endDiff = new Date(lot.auctionEndAt).getTime() - now;
        if (endDiff > 0) return this.formatDiff(endDiff);
      }
      return 'Идёт';
    }

    return this.formatDiff(diff);
  }

  private formatDiff(diff: number): string {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const h = hours % 24;
      return `${days}д ${h}ч ${minutes}м`;
    }

    if (hours > 0) {
      return `${hours}ч ${minutes}м ${seconds}с`;
    }

    return `${minutes}м ${seconds}с`;
  }

  getCountdownClass(lot: ILot): string {
    const target = lot.auctionStartAt || lot.auctionEndAt;
    if (!target) return '';

    const diff = new Date(target).getTime() - Date.now();

    if (diff <= 0) return 'auction-card__countdown--live';
    if (diff < 60 * 60 * 1000) return 'auction-card__countdown--soon';
    return '';
  }

  getStatusLabel(lot: ILot): string {
    const target = lot.auctionStartAt;
    if (!target) return 'Запланирован';

    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return 'Идёт торг';
    return 'Начало через';
  }

  getFuelLabel(fuelType: string): string {
    const labels: Record<string, string> = {
      petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид',
      electric: 'Электро', lpg: 'Газ', other: 'Другое',
    };
    return labels[fuelType] || fuelType || '-';
  }
}
