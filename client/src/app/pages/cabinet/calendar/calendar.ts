import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FavoritesService } from '../../../core/services/favorites.service';
import { IFavorite } from '../../../models/favorite.model';

interface CalendarGroup {
  dateKey: string;
  displayDate: string;
  dayOfWeek: string;
  isToday: boolean;
  isPast: boolean;
  favorites: IFavorite[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class CalendarComponent implements OnInit, OnDestroy {
  private readonly favoritesService = inject(FavoritesService);
  private readonly destroy$ = new Subject<void>();

  groups: CalendarGroup[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadCalendar();
  }

  private loadCalendar(): void {
    this.loading = true;
    this.error = '';

    this.favoritesService.getCalendarFavorites()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (favorites) => {
          this.groups = this.groupByDate(favorites);
          this.loading = false;
        },
        error: () => {
          this.error = 'Не удалось загрузить календарь';
          this.loading = false;
        },
      });
  }

  private groupByDate(favorites: IFavorite[]): CalendarGroup[] {
    const now = new Date();
    const todayStr = this.toDateKey(now);
    const map = new Map<string, IFavorite[]>();

    for (const fav of favorites) {
      if (!fav.lot.auctionStartAt) continue;
      const key = this.toDateKey(new Date(fav.lot.auctionStartAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(fav);
    }

    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));

    return sorted.map(([dateKey, favs]) => {
      const date = new Date(dateKey + 'T00:00:00');
      return {
        dateKey,
        displayDate: this.formatDateRu(date),
        dayOfWeek: this.getDayOfWeekRu(date),
        isToday: dateKey === todayStr,
        isPast: dateKey < todayStr,
        favorites: favs,
      };
    });
  }

  private toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatDateRu(d: Date): string {
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private getDayOfWeekRu(d: Date): string {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return days[d.getDay()];
  }

  getAuctionTime(fav: IFavorite): string {
    if (!fav.lot.auctionStartAt) return '';
    const d = new Date(fav.lot.auctionStartAt);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  getLotTitle(fav: IFavorite): string {
    return [fav.lot.brand, fav.lot.model, fav.lot.year]
      .filter(v => v != null && v !== '')
      .join(' ');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
