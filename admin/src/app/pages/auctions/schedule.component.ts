import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LotService, ILot } from '../../core/services/lot.service';
import { BotService, IBotUser, BotPattern } from '../../core/services/bot.service';
import { BotSettingsComponent } from '../../components/bot-settings/bot-settings.component';

type Tab = 'upcoming' | 'current' | 'past' | 'plan' | 'calendar';

interface CalendarCell {
  date: Date | null;
  lots: ILot[];
  isToday: boolean;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, RouterLink, BotSettingsComponent],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class SchedulePage implements OnInit {
  private readonly lotService = inject(LotService);
  private readonly botService = inject(BotService);

  activeTab: Tab = 'upcoming';

  // ─── Auction lists (per-tab pagination) ───────────────────────────────────
  upcomingLots: ILot[] = [];
  upcomingTotal = 0;
  upcomingPage = 1;
  upcomingLoading = false;
  upcomingLoadingMore = false;

  currentLots: ILot[] = [];
  currentTotal = 0;
  currentPage = 1;
  currentLoading = false;
  currentLoadingMore = false;

  pastLots: ILot[] = [];
  pastTotal = 0;
  pastPage = 1;
  pastLoading = false;
  pastLoadingMore = false;

  calendarLoading = false;

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
  readonly yearRange = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 2 + i);

  // ─── Calendar Edit ─────────────────────────────────────────────────────────
  selectedCalendarLot: ILot | null = null;
  editStartAt = '';
  editEndAt = '';
  editAuctionType = 'timed';
  editSaving = false;
  editSaved = false;
  editSaveError = '';
  editUnscheduling = false;

  // ─── Fill Month ─────────────────────────────────────────────────────────────
  fillMonthOpen = false;
  fillMonthSettings = {
    minPerDay: 1,
    maxPerDay: 3,
    minDurationHours: 1,
    maxDurationHours: 4,
    startHour: 9,
    endHour: 18,
    auctionType: 'timed',
    skipWeekends: true,
    skipExisting: true,
    filterBrands: [] as string[],
    filterStatuses: ['imported', 'active'] as string[],
    // Bot auto-assignment
    assignBots: false,
    botCount: 2,
    botMaxPricePercent: 80,
    botPattern: 'RANDOM' as BotPattern,
    botMinDelaySec: 3,
    botMaxDelaySec: 15,
    botIntensity: 1.0,
  };
  fillMonthRunning = false;
  fillMonthProgress = 0;
  fillMonthTotal = 0;
  fillMonthDone = false;
  fillMonthError = '';
  fillMonthErrors = 0;
  availableBrands: string[] = [];
  availableBotUsers: IBotUser[] = [];
  readonly botPatterns: BotPattern[] = ['AGGRESSIVE', 'STEADY', 'SNIPER', 'RANDOM'];

  // ─── Pagination getters ───────────────────────────────────────────────────
  get hasMoreUpcoming(): boolean { return this.upcomingPage * PAGE_SIZE < this.upcomingTotal; }
  get hasMoreCurrent(): boolean { return this.currentPage * PAGE_SIZE < this.currentTotal; }
  get hasMorePast(): boolean { return this.pastPage * PAGE_SIZE < this.pastTotal; }

  ngOnInit(): void {
    this.loadUpcoming(true);
    this.loadCurrent(true);
    this.loadPast(true);
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    if (tab === 'calendar') {
      this.loadCalendarData();
    } else if (tab === 'plan') {
      if (this.planLots.length === 0 && !this.planLotsLoading) {
        this.loadPlanLots();
      }
    } else if (tab === 'upcoming') {
      if (!this.upcomingLoading) this.loadUpcoming(true);
    } else if (tab === 'current') {
      if (!this.currentLoading) this.loadCurrent(true);
    } else if (tab === 'past') {
      if (!this.pastLoading) this.loadPast(true);
    }
  }

  // ─── Per-tab loading ──────────────────────────────────────────────────────

  loadUpcoming(reset = false): void {
    if (reset) {
      this.upcomingPage = 1;
      this.upcomingLoading = true;
    } else {
      this.upcomingPage++;
      this.upcomingLoadingMore = true;
    }

    this.lotService.getLots({ page: this.upcomingPage, limit: PAGE_SIZE, status: 'active' }).subscribe({
      next: (res) => {
        const now = Date.now();
        const incoming = res.data.filter(l => {
          const start = l.auctionStartAt || l.auctionStart;
          return start && new Date(start).getTime() > now;
        });
        this.upcomingLots = reset ? incoming : [...this.upcomingLots, ...incoming];
        this.upcomingTotal = res.total;
        this.sortUpcoming();
        this.upcomingLoading = false;
        this.upcomingLoadingMore = false;
      },
      error: () => {
        if (!reset) this.upcomingPage--;
        this.upcomingLoading = false;
        this.upcomingLoadingMore = false;
      },
    });
  }

  loadCurrent(reset = false): void {
    if (reset) {
      this.currentPage = 1;
      this.currentLoading = true;
    } else {
      this.currentPage++;
      this.currentLoadingMore = true;
    }

    this.lotService.getLots({ page: this.currentPage, limit: PAGE_SIZE, status: 'trading' }).subscribe({
      next: (res) => {
        this.currentLots = reset ? res.data : [...this.currentLots, ...res.data];
        this.currentTotal = res.total;
        this.sortCurrent();
        this.currentLoading = false;
        this.currentLoadingMore = false;
      },
      error: () => {
        if (!reset) this.currentPage--;
        this.currentLoading = false;
        this.currentLoadingMore = false;
      },
    });
  }

  loadPast(reset = false): void {
    if (reset) {
      this.pastPage = 1;
      this.pastLoading = true;
    } else {
      this.pastPage++;
      this.pastLoadingMore = true;
    }

    this.lotService.getLots({ page: this.pastPage, limit: PAGE_SIZE, status: 'sold' }).subscribe({
      next: (res) => {
        this.pastLots = reset ? res.data : [...this.pastLots, ...res.data];
        this.pastTotal = res.total;
        this.sortPast();
        this.pastLoading = false;
        this.pastLoadingMore = false;
      },
      error: () => {
        if (!reset) this.pastPage--;
        this.pastLoading = false;
        this.pastLoadingMore = false;
      },
    });
  }

  loadMoreUpcoming(): void {
    if (!this.upcomingLoadingMore && this.hasMoreUpcoming) this.loadUpcoming(false);
  }

  loadMoreCurrent(): void {
    if (!this.currentLoadingMore && this.hasMoreCurrent) this.loadCurrent(false);
  }

  loadMorePast(): void {
    if (!this.pastLoadingMore && this.hasMorePast) this.loadPast(false);
  }

  private sortUpcoming(): void {
    const now = Date.now();
    this.upcomingLots.sort((a, b) => {
      const aStart = new Date(a.auctionStartAt || a.auctionStart || 0).getTime();
      const bStart = new Date(b.auctionStartAt || b.auctionStart || 0).getTime();
      return Math.abs(aStart - now) - Math.abs(bStart - now);
    });
  }

  private sortCurrent(): void {
    this.currentLots.sort((a, b) => {
      const aEnd = new Date(a.auctionEndAt || a.auctionEnd || 0).getTime();
      const bEnd = new Date(b.auctionEndAt || b.auctionEnd || 0).getTime();
      return aEnd - bEnd;
    });
  }

  private sortPast(): void {
    this.pastLots.sort((a, b) => {
      const aEnd = new Date(a.auctionEndAt || a.auctionEnd || 0).getTime();
      const bEnd = new Date(b.auctionEndAt || b.auctionEnd || 0).getTime();
      return bEnd - aEnd;
    });
  }

  // ─── Calendar ─────────────────────────────────────────────────────────────

  loadCalendarData(): void {
    const year = this.calendarYear;
    const month = this.calendarMonth;
    const dateFrom = new Date(year, month, 1).toISOString();
    const dateTo = new Date(year, month + 1, 1).toISOString();

    this.calendarLoading = true;
    this.lotService.getLots({ limit: 500, dateFrom, dateTo }).subscribe({
      next: (res) => {
        this.upcomingLots = res.data.filter(l => l.status === 'active');
        this.currentLots = res.data.filter(l => l.status === 'trading');
        this.pastLots = res.data.filter(l => !['active', 'trading'].includes(l.status));
        this.calendarLoading = false;
        this.buildCalendar();
      },
      error: () => {
        this.calendarLoading = false;
        this.buildCalendar();
      },
    });
  }

  buildCalendar(): void {
    const year = this.calendarYear;
    const month = this.calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();

    // Deduplicate by ID before building the calendar
    const seen = new Set<string>();
    const allLots = [...this.upcomingLots, ...this.currentLots, ...this.pastLots]
      .filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });

    // Build day → lots map in O(n) instead of filtering per day
    const lotsByDay = new Map<number, ILot[]>();
    for (const lot of allLots) {
      const start = lot.auctionStartAt || lot.auctionStart;
      if (!start) continue;
      const s = new Date(start);
      if (s.getFullYear() === year && s.getMonth() === month) {
        const day = s.getDate();
        if (!lotsByDay.has(day)) lotsByDay.set(day, []);
        lotsByDay.get(day)!.push(lot);
      }
    }

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
      const lots = lotsByDay.get(d) ?? [];
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
    this.loadCalendarData();
  }

  nextMonth(): void {
    if (this.calendarMonth === 11) {
      this.calendarMonth = 0;
      this.calendarYear++;
    } else {
      this.calendarMonth++;
    }
    this.loadCalendarData();
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
        // Populate available brands for fill-month filter
        const brands = new Set(this.planLots.map(l => l.brand).filter(Boolean));
        this.availableBrands = Array.from(brands).sort();
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

  // ─── Calendar Edit Methods ──────────────────────────────────────────────────

  openCalendarLotEdit(lot: ILot, event: Event): void {
    event.stopPropagation();
    this.selectedCalendarLot = lot;
    const start = lot.auctionStartAt || lot.auctionStart;
    const end = lot.auctionEndAt || lot.auctionEnd;
    this.editStartAt = start ? new Date(start).toISOString().slice(0, 16) : '';
    this.editEndAt = end ? new Date(end).toISOString().slice(0, 16) : '';
    this.editAuctionType = lot.auctionType || 'timed';
    this.editSaved = false;
    this.editSaveError = '';
  }

  closeCalendarEdit(): void {
    this.selectedCalendarLot = null;
  }

  saveCalendarEdit(): void {
    if (!this.selectedCalendarLot || !this.editStartAt || !this.editEndAt) return;
    this.editSaving = true;
    this.editSaved = false;
    this.editSaveError = '';

    this.lotService.scheduleLot(this.selectedCalendarLot.id, {
      auctionStartAt: new Date(this.editStartAt).toISOString(),
      auctionEndAt: new Date(this.editEndAt).toISOString(),
      auctionType: this.editAuctionType,
    }).subscribe({
      next: (lot) => {
        this.updateLotInLists(lot);
        this.selectedCalendarLot = lot;
        this.buildCalendar();
        this.editSaving = false;
        this.editSaved = true;
        setTimeout(() => (this.editSaved = false), 3000);
      },
      error: (err) => {
        this.editSaveError = err?.error?.message ?? 'Ошибка сохранения';
        this.editSaving = false;
      },
    });
  }

  unscheduleLot(): void {
    if (!this.selectedCalendarLot) return;
    this.editUnscheduling = true;

    this.lotService.updateLot(this.selectedCalendarLot.id, {
      auctionStartAt: null,
      auctionEndAt: null,
    } as any).subscribe({
      next: () => {
        this.removeLotFromLists(this.selectedCalendarLot!.id);
        this.buildCalendar();
        this.editUnscheduling = false;
        this.selectedCalendarLot = null;
      },
      error: () => { this.editUnscheduling = false; },
    });
  }

  private updateLotInLists(lot: ILot): void {
    const update = (arr: ILot[]) => {
      const idx = arr.findIndex(l => l.id === lot.id);
      if (idx >= 0) arr[idx] = lot;
    };
    update(this.upcomingLots);
    update(this.currentLots);
    update(this.pastLots);
  }

  private removeLotFromLists(id: string): void {
    this.upcomingLots = this.upcomingLots.filter(l => l.id !== id);
    this.currentLots = this.currentLots.filter(l => l.id !== id);
    this.pastLots = this.pastLots.filter(l => l.id !== id);
  }

  // ─── Fill Month Methods ─────────────────────────────────────────────────────

  toggleFillMonth(): void {
    this.fillMonthOpen = !this.fillMonthOpen;
    if (this.fillMonthOpen) {
      this.fillMonthDone = false;
      this.fillMonthError = '';
      this.fillMonthErrors = 0;
      this.fillMonthProgress = 0;
      this.fillMonthTotal = 0;
      if (this.availableBotUsers.length === 0) {
        this.botService.getBotUsers().subscribe({
          next: (users) => { this.availableBotUsers = users; },
        });
      }
    }
  }

  toggleFilterBrand(brand: string): void {
    const idx = this.fillMonthSettings.filterBrands.indexOf(brand);
    if (idx >= 0) {
      this.fillMonthSettings.filterBrands.splice(idx, 1);
    } else {
      this.fillMonthSettings.filterBrands.push(brand);
    }
  }

  toggleFilterStatus(status: string): void {
    const idx = this.fillMonthSettings.filterStatuses.indexOf(status);
    if (idx >= 0) {
      if (this.fillMonthSettings.filterStatuses.length > 1) {
        this.fillMonthSettings.filterStatuses.splice(idx, 1);
      }
    } else {
      this.fillMonthSettings.filterStatuses.push(status);
    }
  }

  async runFillMonth(): Promise<void> {
    this.fillMonthRunning = true;
    this.fillMonthProgress = 0;
    this.fillMonthTotal = 0;
    this.fillMonthDone = false;
    this.fillMonthError = '';
    this.fillMonthErrors = 0;

    const s = this.fillMonthSettings;

    // Step 1: Load all available lots
    let pool: ILot[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        this.lotService.getLots({ limit: 500 }).subscribe({
          next: (res) => {
            const now = Date.now();
            pool = res.data.filter(l => {
              if (!s.filterStatuses.includes(l.status)) return false;
              // Exclude already scheduled in the future
              const start = l.auctionStartAt || l.auctionStart;
              if (start && new Date(start).getTime() > now) return false;
              // Brand filter
              if (s.filterBrands.length > 0 && !s.filterBrands.includes(l.brand)) return false;
              return true;
            });
            resolve();
          },
          error: reject,
        });
      });
    } catch {
      this.fillMonthError = 'Не удалось загрузить лоты';
      this.fillMonthRunning = false;
      return;
    }

    if (pool.length === 0) {
      this.fillMonthError = 'Нет доступных лотов для планирования';
      this.fillMonthRunning = false;
      return;
    }

    // Step 2: Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const year = this.calendarYear;
    const month = this.calendarMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const allScheduledLots = [...this.upcomingLots, ...this.currentLots];

    // Step 3: Build task list
    const tasks: Array<{ lot: ILot; startAt: Date; endAt: Date }> = [];
    let poolIdx = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      if (poolIdx >= pool.length) break;

      const date = new Date(year, month, day);
      if (date < todayMidnight) continue;

      const dow = date.getDay(); // 0=Sun, 6=Sat
      if (s.skipWeekends && (dow === 0 || dow === 6)) continue;

      if (s.skipExisting) {
        const hasExisting = allScheduledLots.some(l => {
          const start = l.auctionStartAt || l.auctionStart;
          if (!start) return false;
          const sd = new Date(start);
          return sd.getFullYear() === year && sd.getMonth() === month && sd.getDate() === day;
        });
        if (hasExisting) continue;
      }

      const n = this.randInt(s.minPerDay, s.maxPerDay);
      const slots = this.generateTimeSlots(date, n, s.startHour, s.endHour, s.minDurationHours, s.maxDurationHours);

      for (const slot of slots) {
        if (poolIdx >= pool.length) break;
        tasks.push({ lot: pool[poolIdx++], startAt: slot.start, endAt: slot.end });
      }
    }

    if (tasks.length === 0) {
      this.fillMonthError = 'Нет доступных дней или лотов для планирования по заданным параметрам';
      this.fillMonthRunning = false;
      return;
    }

    this.fillMonthTotal = tasks.length;

    // Step 4: Execute sequentially (schedule + assign bots)
    for (const task of tasks) {
      try {
        const lot = await new Promise<ILot>((resolve, reject) => {
          this.lotService.scheduleLot(task.lot.id, {
            auctionStartAt: task.startAt.toISOString(),
            auctionEndAt: task.endAt.toISOString(),
            auctionType: s.auctionType,
          }).subscribe({
            next: (scheduledLot) => {
              const existingIdx = this.upcomingLots.findIndex(l => l.id === scheduledLot.id);
              if (existingIdx >= 0) {
                this.upcomingLots[existingIdx] = scheduledLot;
              } else {
                this.upcomingLots.push(scheduledLot);
              }
              resolve(scheduledLot);
            },
            error: (err) => reject(err),
          });
        });

        // Auto-assign bots if enabled
        if (s.assignBots && this.availableBotUsers.length > 0) {
          const startingBid = task.lot.startingBid || task.lot.currentPrice || 1000;
          const maxPrice = Math.round(startingBid * (s.botMaxPricePercent / 100));
          const count = Math.min(s.botCount, this.availableBotUsers.length);

          for (let i = 0; i < count; i++) {
            const botUser = this.availableBotUsers[i % this.availableBotUsers.length];
            try {
              await new Promise<void>((resolve, reject) => {
                this.botService.createConfig({
                  lotId: lot.id,
                  botUserId: botUser.id,
                  maxPrice,
                  pattern: s.botPattern,
                  isActive: true,
                  minDelaySec: s.botMinDelaySec,
                  maxDelaySec: s.botMaxDelaySec,
                  intensity: s.botIntensity,
                }).subscribe({
                  next: () => resolve(),
                  error: () => resolve(),
                });
              });
            } catch {
              // Bot assignment errors are non-critical
            }
          }
        }
      } catch {
        this.fillMonthErrors++;
      }
      this.fillMonthProgress++;
    }

    this.fillMonthRunning = false;
    this.fillMonthDone = true;
    // Reload from DB so calendar reflects what's actually persisted
    this.loadCalendarData();
  }

  private generateTimeSlots(
    date: Date,
    n: number,
    startHour: number,
    endHour: number,
    minDurH: number,
    maxDurH: number,
  ): Array<{ start: Date; end: Date }> {
    const slots: Array<{ start: Date; end: Date }> = [];
    const windowMin = (endHour - startHour) * 60;
    const gapMin = 15;

    // Determine how many slots fit — use average duration estimate
    const avgDur = ((minDurH + maxDurH) / 2) * 60;
    const maxFit = Math.max(1, Math.floor((windowMin + gapMin) / (avgDur + gapMin)));
    const count = Math.min(n, maxFit);
    if (count === 0) return slots;

    // Distribute slots evenly with jitter
    const totalFreeBase = windowMin - count * avgDur - (count - 1) * gapMin;
    const segment = Math.max(0, Math.floor(totalFreeBase / (count + 1)));

    let cursor = startHour * 60; // minutes from midnight

    for (let i = 0; i < count; i++) {
      const jitter = segment > 0 ? this.randInt(0, Math.min(segment, 20)) : 0;
      const durMin = this.randInt(minDurH * 60, maxDurH * 60);

      const startMin = cursor + (i === 0 ? segment + jitter : gapMin);
      const endMin = startMin + durMin;

      if (endMin > endHour * 60) break; // doesn't fit — stop

      const start = new Date(date);
      start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

      const end = new Date(date);
      end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

      slots.push({ start, end });
      cursor = endMin;
    }

    return slots;
  }

  private randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ─── Utility ────────────────────────────────────────────────────────────────

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
