import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { LotService, ILot } from '../../core/services/lot.service';
import { BotSettingsComponent } from '../../components/bot-settings/bot-settings.component';

type Tab = 'upcoming' | 'current' | 'past' | 'plan' | 'calendar';

interface CalendarCell {
  date: Date | null;
  lots: ILot[];
  isToday: boolean;
}

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, BotSettingsComponent],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class SchedulePage implements OnInit {
  private readonly lotService = inject(LotService);

  activeTab: Tab = 'upcoming';

  // ─── Auction lists ─────────────────────────────────────────────────────────
  upcomingLots: ILot[] = [];
  currentLots: ILot[] = [];
  pastLots: ILot[] = [];
  listsLoading = false;

  // ─── Lot picker for planning ────────────────────────────────────────────────
  planLots: ILot[] = [];
  planLotsLoading = false;
  lotSearch = '';
  selectedLot: ILot | null = null;

  // ─── Schedule form ──────────────────────────────────────────────────────────
  auctionStartAt = '';
  auctionEndAt = '';
  auctionType = 'timed';
  enableBot = false;
  saving = false;
  saved = false;
  saveError = '';

  readonly auctionTypes = [
    { value: 'timed', label: 'Тендер (по времени)' },
    { value: 'buy_now', label: 'Купить сейчас' },
    { value: 'both', label: 'Тендер + Купить сейчас' },
  ];

  // ─── Calendar ───────────────────────────────────────────────────────────────
  readonly weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  readonly monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  calendarCells: CalendarCell[][] = [];

  ngOnInit(): void {
    this.loadAuctionLists();
    this.loadPlanLots();
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    if (tab === 'calendar') {
      if (!this.listsLoading && this.upcomingLots.length === 0 && this.currentLots.length === 0 && this.pastLots.length === 0) {
        this.loadAuctionLists();
      } else {
        this.buildCalendar();
      }
    } else if (tab !== 'plan' && !this.listsLoading) {
      this.loadAuctionLists();
    }
  }

  loadAuctionLists(): void {
    this.listsLoading = true;
    let loaded = 0;
    const done = () => {
      if (++loaded === 3) {
        this.listsLoading = false;
        if (this.activeTab === 'calendar') {
          this.buildCalendar();
        }
      }
    };

    this.lotService.getLots({ limit: 50, status: 'active' }).subscribe({
      next: (res) => {
        const now = Date.now();
        this.upcomingLots = res.data.filter(l => {
          const start = l.auctionStartAt || l.auctionStart;
          return start && new Date(start).getTime() > now;
        });
        done();
      },
      error: done,
    });

    this.lotService.getLots({ limit: 50, status: 'trading' }).subscribe({
      next: (res) => { this.currentLots = res.data; done(); },
      error: done,
    });

    this.lotService.getLots({ limit: 50, status: 'sold' }).subscribe({
      next: (res) => { this.pastLots = res.data; done(); },
      error: done,
    });
  }

  buildCalendar(): void {
    const year = this.calendarYear;
    const month = this.calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();

    const allLots = [...this.upcomingLots, ...this.currentLots, ...this.pastLots];

    // Start week on Monday (0=Mon … 6=Sun)
    let startDow = firstDay.getDay();
    startDow = (startDow + 6) % 7;

    const cells: CalendarCell[] = [];

    // Leading empty cells
    for (let i = 0; i < startDow; i++) {
      cells.push({ date: null, lots: [], isToday: false });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const lots = allLots.filter(l => {
        const start = l.auctionStartAt || l.auctionStart;
        if (!start) return false;
        const s = new Date(start);
        return s.getFullYear() === year && s.getMonth() === month && s.getDate() === d;
      });
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === d;
      cells.push({ date, lots, isToday });
    }

    // Trailing empty cells
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, lots: [], isToday: false });
    }

    // Group into rows of 7
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    this.calendarCells = rows;
  }

  prevMonth(): void {
    if (this.calendarMonth === 0) {
      this.calendarMonth = 11;
      this.calendarYear--;
    } else {
      this.calendarMonth--;
    }
    this.buildCalendar();
  }

  nextMonth(): void {
    if (this.calendarMonth === 11) {
      this.calendarMonth = 0;
      this.calendarYear++;
    } else {
      this.calendarMonth++;
    }
    this.buildCalendar();
  }

  lotStatusClass(lot: ILot): string {
    if (lot.status === 'trading') return 'cal-lot--current';
    if (lot.status === 'sold') return 'cal-lot--past';
    return 'cal-lot--upcoming';
  }

  loadPlanLots(): void {
    this.planLotsLoading = true;
    this.lotService.getLots({ limit: 100, search: this.lotSearch || undefined }).subscribe({
      next: (res) => {
        this.planLots = res.data.filter(l => ['imported', 'active'].includes(l.status));
        this.planLotsLoading = false;
      },
      error: () => (this.planLotsLoading = false),
    });
  }

  selectLot(lot: ILot): void {
    this.selectedLot = lot;
    const start = lot.auctionStartAt || lot.auctionStart;
    const end = lot.auctionEndAt || lot.auctionEnd;
    if (start) this.auctionStartAt = start.slice(0, 16);
    if (end) this.auctionEndAt = end.slice(0, 16);
  }

  save(): void {
    if (!this.selectedLot || !this.auctionStartAt || !this.auctionEndAt) return;
    this.saving = true;
    this.saved = false;
    this.saveError = '';

    this.lotService
      .scheduleLot(this.selectedLot.id, {
        auctionStartAt: new Date(this.auctionStartAt).toISOString(),
        auctionEndAt: new Date(this.auctionEndAt).toISOString(),
        auctionType: this.auctionType,
      })
      .subscribe({
        next: (lot) => {
          this.selectedLot = lot;
          this.saving = false;
          this.saved = true;
          setTimeout(() => (this.saved = false), 3000);
        },
        error: (err) => {
          this.saveError = err?.error?.message ?? 'Ошибка сохранения';
          this.saving = false;
        },
      });
  }

  getTimeLeft(endAt: string | null): string {
    if (!endAt) return '—';
    const diff = new Date(endAt).getTime() - Date.now();
    if (diff <= 0) return 'завершён';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}ч ${m}м`;
    return `${m}м`;
  }

  getTimeUntil(startAt: string | null): string {
    if (!startAt) return '—';
    const diff = new Date(startAt).getTime() - Date.now();
    if (diff <= 0) return 'скоро';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `через ${d}д ${h}ч`;
    if (h > 0) return `через ${h}ч ${m}м`;
    return `через ${m}м`;
  }
}
