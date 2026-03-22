import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { Subject, takeUntil, forkJoin, interval } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { AuctionStateService } from '../../core/services/auction-state.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { ILot, ImageCategory, LotStatus } from '../../models/lot.model';
import { IFeedUpdate } from '../../models/auction.model';

interface DayGroup {
  date: Date;
  label: string;
  lots: ILot[];
}

interface BidDelta {
  amount: number;
  delta: number;
  bidderFlag: string;
  timestamp: string;
}

@Component({
  selector: 'app-auctions',
  standalone: true,
  imports: [RouterLink, DecimalPipe, SlicePipe],
  templateUrl: './auctions.html',
  styleUrl: './auctions.scss',
})
export class AuctionsComponent implements OnInit, OnDestroy {
  private readonly lotService = inject(LotService);
  private readonly auctionState = inject(AuctionStateService);
  private readonly wsService = inject(WebsocketService);
  private readonly destroy$ = new Subject<void>();

  loading = true;
  now = Date.now();

  liveLots: ILot[] = [];
  dayGroups: DayGroup[] = [];
  upcomingTotal = 0;

  bidFeed: IFeedUpdate[] = [];
  recentDeltas: BidDelta[] = [];
  pricePulsingId: string | null = null;
  private pricePulseTimer: ReturnType<typeof setTimeout> | null = null;
  private watchedIds = new Set<string>();

  ngOnInit(): void {
    this.loadAuctions();

    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => { this.now = Date.now(); });

    this.auctionState.priceUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        const lot = this.liveLots.find((l) => l.id === update.lotId);
        if (!lot) return;

        const prev = this.getLivePrice(lot);
        const delta = update.currentPrice - prev;

        if (this.liveLots[0]?.id === update.lotId && delta > 0) {
          this.recentDeltas = [
            { amount: update.currentPrice, delta, bidderFlag: '🏁', timestamp: new Date().toISOString() },
            ...this.recentDeltas,
          ].slice(0, 4);
        }

        this.pricePulsingId = update.lotId;
        if (this.pricePulseTimer) clearTimeout(this.pricePulseTimer);
        this.pricePulseTimer = setTimeout(() => { this.pricePulsingId = null; }, 750);

        lot.currentPrice = update.currentPrice;
        if (update.auctionEndAt !== undefined) lot.auctionEndAt = update.auctionEndAt;
      });

    this.wsService.feedUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((entry) => {
        this.bidFeed = [entry, ...this.bidFeed].slice(0, 40);
      });
  }

  ngOnDestroy(): void {
    if (this.pricePulseTimer) clearTimeout(this.pricePulseTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAuctions(): void {
    this.loading = true;

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 3);
    endDate.setHours(23, 59, 59, 999);

    forkJoin({
      live: this.lotService.getAll({ status: LotStatus.TRADING, limit: 50 }),
      upcoming: this.lotService.getAll({
        dateFrom: now.toISOString(),
        dateTo: endDate.toISOString(),
        limit: 200,
        sort: 'auction_asc',
      }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ live, upcoming }) => {
          this.liveLots = live.data || [];
          this.auctionState.seedFromLots(this.liveLots);
          this.upcomingTotal = upcoming.total || 0;
          this.dayGroups = this.groupByDay(upcoming.data || []);
          this.loading = false;
        },
        error: () => { this.loading = false; },
      });
  }

  private groupByDay(lots: ILot[]): DayGroup[] {
    const groups = new Map<string, DayGroup>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const lot of lots) {
      const auctionDate = new Date(lot.auctionStartAt || lot.auctionEndAt || lot.createdAt);
      const dateKey = auctionDate.toISOString().split('T')[0];

      if (!groups.has(dateKey)) {
        const lotDay = new Date(dateKey + 'T00:00:00');
        let label: string;
        if (lotDay.getTime() === today.getTime()) label = 'Сегодня';
        else if (lotDay.getTime() === tomorrow.getTime()) label = 'Завтра';
        else label = this.formatDateLabel(lotDay);
        groups.set(dateKey, { date: lotDay, label, lots: [] });
      }
      groups.get(dateKey)!.lots.push(lot);
    }

    return Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private formatDateLabel(date: Date): string {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  }

  getLivePrice(lot: ILot): number {
    const p = this.auctionState.getLotPrice(lot.id);
    if (p !== null) return p;
    if (lot.currentPrice) return parseFloat(String(lot.currentPrice));
    if (lot.startingBid) return parseFloat(String(lot.startingBid));
    return 0;
  }

  getTimeLeft(lot: ILot): string {
    const endAt = this.auctionState.getLotEndAt(lot.id) ?? lot.auctionEndAt;
    if (!endAt) return '--:--';
    const diff = new Date(endAt).getTime() - this.now;
    if (diff <= 0) return '0:00';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getTimerClass(lot: ILot): string {
    const endAt = this.auctionState.getLotEndAt(lot.id) ?? lot.auctionEndAt;
    if (!endAt) return 'timer--green';
    const diff = new Date(endAt).getTime() - this.now;
    if (diff < 30000) return 'timer--red';
    if (diff < 120000) return 'timer--yellow';
    return 'timer--green';
  }

  getCountdown(lot: ILot): string {
    const target = lot.auctionStartAt;
    if (!target) return '';
    const diff = new Date(target).getTime() - this.now;
    if (diff <= 0) return 'Начинается';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}д ${h % 24}ч`;
    if (h > 0) return `${h}ч ${m}м`;
    return `${m}м`;
  }

  getMainImage(lot: ILot): string | null {
    if (lot.images?.length) {
      const main = lot.images.find((img) => img.category === ImageCategory.MAIN);
      return this.getImageUrl((main || lot.images[0]).url);
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

  getFuelLabel(fuelType: string): string {
    const labels: Record<string, string> = {
      petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид',
      electric: 'Электро', lpg: 'Газ', other: 'Другое',
    };
    return labels[fuelType] || fuelType || '-';
  }

  getRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}с`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}м`;
    return `${Math.floor(diff / 3600000)}ч`;
  }

  isWatching(lot: ILot): boolean {
    return this.watchedIds.has(lot.id);
  }

  toggleWatch(lot: ILot): void {
    if (this.watchedIds.has(lot.id)) this.watchedIds.delete(lot.id);
    else this.watchedIds.add(lot.id);
  }
}
