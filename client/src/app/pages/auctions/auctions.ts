import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { ILot, ImageCategory } from '../../models/lot.model';

interface CalendarCell {
  date: Date;
  dateKey: string; // 'YYYY-MM-DD'
  inMonth: boolean;
  isPast: boolean;
  lotCount: number;
}

@Component({
  selector: 'app-auctions',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './auctions.html',
  styleUrl: './auctions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly cache = new Map<string, ILot[]>();

  loading = false;
  viewDate = new Date(); // current month being viewed
  cells: CalendarCell[] = [];
  selectedDateKey: string | null = null;
  selectedLots: ILot[] = [];

  readonly weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  readonly skeletonCells = Array.from({ length: 35 }, (_, i) => i);
  readonly monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];

  constructor(
    private readonly lotService: LotService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadMonth(this.viewDate);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get monthLabel(): string {
    return `${this.monthNames[this.viewDate.getMonth()]} ${this.viewDate.getFullYear()}`;
  }

  prevMonth(): void {
    const now = new Date();
    if (
      this.viewDate.getFullYear() === now.getFullYear() &&
      this.viewDate.getMonth() === now.getMonth()
    ) return;
    const d = new Date(this.viewDate);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    this.viewDate = d;
    this.selectedDateKey = null;
    this.selectedLots = [];
    this.loadMonth(d);
  }

  nextMonth(): void {
    const d = new Date(this.viewDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    this.viewDate = d;
    this.selectedDateKey = null;
    this.selectedLots = [];
    this.loadMonth(d);
  }

  selectDay(cell: CalendarCell): void {
    if (cell.isPast || cell.lotCount === 0) return;
    if (this.selectedDateKey === cell.dateKey) {
      this.selectedDateKey = null;
      this.selectedLots = [];
      return;
    }
    this.selectedDateKey = cell.dateKey;
    const cacheKey = this.monthKey(this.viewDate);
    const lots = this.cache.get(cacheKey) ?? [];
    this.selectedLots = lots.filter(lot => {
      const d = new Date(lot.auctionStartAt ?? lot.auctionEndAt ?? lot.createdAt);
      return this.toDateKey(d) === cell.dateKey;
    });
    this.cdr.markForCheck();
  }

  navigateToLive(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/live']);
  }

  getLotCountLabel(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} лот`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} лота`;
    return `${count} лотов`;
  }

  isLotActive(lot: ILot): boolean {
    const now = Date.now();
    const start = lot.auctionStartAt ? new Date(lot.auctionStartAt).getTime() : null;
    const end = lot.auctionEndAt ? new Date(lot.auctionEndAt).getTime() : null;
    if (start && end) return now >= start && now <= end;
    if (start) return now >= start;
    return false;
  }

  getMainImage(lot: ILot): string | null {
    if (lot.images?.length) {
      const main = lot.images.find(img => img.category === ImageCategory.MAIN) ?? lot.images[0];
      const url = main.url;
      if (url.startsWith('http')) return url;
      return `${environment.apiUrl.replace('/api', '')}${url}`;
    }
    if (lot.sourceImageUrl) {
      return lot.sourceImageUrl.startsWith('//') ? 'https:' + lot.sourceImageUrl : lot.sourceImageUrl;
    }
    return null;
  }

  getLotTime(lot: ILot): string {
    const target = lot.auctionStartAt ?? lot.auctionEndAt;
    if (!target) return '';
    return new Date(target).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  private loadMonth(date: Date): void {
    const key = this.monthKey(date);
    if (this.cache.has(key)) {
      this.buildGrid(date, this.cache.get(key)!);
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    this.lotService.getAll({
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      limit: 500,
      sort: 'date_asc',
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const lots = res.data ?? [];
          this.cache.set(key, lots);
          this.buildGrid(date, lots);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.buildGrid(date, []);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private buildGrid(date: Date, lots: ILot[]): void {
    const countMap = new Map<string, number>();
    for (const lot of lots) {
      const d = new Date(lot.auctionStartAt ?? lot.auctionEndAt ?? lot.createdAt);
      const key = this.toDateKey(d);
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const endOffset = (6 - (lastOfMonth.getDay() + 6) % 7);
    const gridEnd = new Date(lastOfMonth);
    gridEnd.setDate(gridEnd.getDate() + endOffset);

    const cells: CalendarCell[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const dateKey = this.toDateKey(cursor);
      cells.push({
        date: new Date(cursor),
        dateKey,
        inMonth: cursor.getMonth() === date.getMonth(),
        isPast: cursor < today,
        lotCount: countMap.get(dateKey) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    this.cells = cells;
    this.cdr.markForCheck();
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
