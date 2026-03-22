# Live Trading & Auction Schedule Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `/live` as the primary trading page with a meaningful empty state, rebuild `/auctions` as a monthly calendar schedule, and add both links to header navigation.

**Architecture:** Three independent tasks in order: (1) navigation update, (2) live page empty state, (3) calendar page full rewrite. No new services or API endpoints required — both pages use the existing `LotService.getAll()`.

**Tech Stack:** Angular 20 standalone components, SCSS BEM, `LotService`, `AuctionService`, RxJS, `RouterLink`

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `client/src/app/components/header/header.html` | Modify | Two nav links instead of one |
| `client/src/app/pages/live-trading/live-trading.ts` | Modify | Add `nextLot` + fetch when empty |
| `client/src/app/pages/live-trading/live-trading.html` | Modify | Replace empty block with banner |
| `client/src/app/pages/live-trading/live-trading.scss` | Modify | Add `.live__no-auctions` styles |
| `client/src/app/pages/auctions/auctions.ts` | Full rewrite | Calendar logic |
| `client/src/app/pages/auctions/auctions.html` | Full rewrite | Calendar grid + detail panel |
| `client/src/app/pages/auctions/auctions.scss` | Full rewrite | Calendar styles |

---

## Task 1: Update header navigation

**Files:**
- Modify: `client/src/app/components/header/header.html`

- [ ] **Step 1: Replace the single "Аукционы" link with two links in the desktop nav**

In `header.html`, find the `<nav class="header__nav">` block (lines 7–12) and replace:
```html
<a routerLink="/auctions" routerLinkActive="active" class="header__nav-link">Аукционы</a>
```
with:
```html
<a routerLink="/live" routerLinkActive="active" class="header__nav-link">Торги</a>
<a routerLink="/auctions" routerLinkActive="active" class="header__nav-link">Расписание</a>
```

- [ ] **Step 2: Replace the single "Аукционы" link in the mobile drawer**

In the same file, find the drawer `<nav class="drawer__nav">` block (lines 64–84) and replace:
```html
<a routerLink="/auctions" routerLinkActive="active" class="drawer__link" (click)="menuOpen.set(false)">
  <span class="material-symbols-rounded">gavel</span>
  Аукционы
</a>
```
with:
```html
<a routerLink="/live" routerLinkActive="active" class="drawer__link" (click)="menuOpen.set(false)">
  <span class="material-symbols-rounded">gavel</span>
  Торги
</a>
<a routerLink="/auctions" routerLinkActive="active" class="drawer__link" (click)="menuOpen.set(false)">
  <span class="material-symbols-rounded">calendar_month</span>
  Расписание
</a>
```

- [ ] **Step 3: Commit**
```bash
git add client/src/app/components/header/header.html
git commit -m "feat(nav): add Торги /live and Расписание /auctions links to header"
```

---

## Task 2: Live Trading — empty state with next auction info

**Files:**
- Modify: `client/src/app/pages/live-trading/live-trading.ts`
- Modify: `client/src/app/pages/live-trading/live-trading.html`
- Modify: `client/src/app/pages/live-trading/live-trading.scss`

### Context

The current empty state (when `auctionList.length === 0`) just shows "No active auctions". We need to replace that with a banner that fetches the next upcoming lot and shows its start time and a link to `/auctions`.

`LotService.getAll()` accepts `{ dateFrom, sort, limit, status }`. To get the next lot, pass:
- `dateFrom`: current ISO datetime
- `sort`: `'date_asc'`
- `limit`: `1`

Note: `LotStatus` enum has no "scheduled" value — just omit status filter to get all future lots.

### Steps

- [ ] **Step 1: Add `nextLot` field and inject `LotService` in live-trading.ts**

In `live-trading.ts`, add imports at the top (existing file already has `takeUntil`, `destroy$`, and all other RxJS/Angular imports):
```typescript
import { RouterLink } from '@angular/router';
import { LotService } from '../../core/services/lot.service';
```
Add `RouterLink` to the `imports` array in `@Component` decorator.

Add field to the class:
```typescript
nextLot: ILot | null = null;
nextLotLoading = false;
```

Inject `LotService` in the constructor:
```typescript
private readonly lotService: LotService,
```

- [ ] **Step 2: Add `loadNextLot()` method**

Add this method to the class:
```typescript
private loadNextLot(): void {
  this.nextLotLoading = true;
  const now = new Date().toISOString();
  this.lotService.getAll({ dateFrom: now, sort: 'date_asc', limit: 1 })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        this.nextLot = res.data[0] ?? null;
        this.nextLotLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.nextLotLoading = false;
        this.cdr.markForCheck();
      },
    });
}
```

- [ ] **Step 3: Call `loadNextLot()` when active lots list is empty**

In the existing `loadActiveLots()` subscribe `next` handler, after setting `this.auctionList`:
```typescript
next: (lots) => {
  this.auctionList = lots;
  this.stats.activeAuctions = lots.length;
  this.loading = false;
  lots.forEach(lot => this.lotTitleMap.set(lot.id, lot.title));
  if (lots.length > 0 && !this.activeLot) {
    this.selectLot(lots[0]);
  }
  // NEW: fetch next lot only when there are no active auctions
  if (lots.length === 0) {
    this.loadNextLot();
  }
  this.cdr.markForCheck();
},
```

- [ ] **Step 4: Add `getNextLotLabel()` helper method**

```typescript
getNextLotLabel(): string {
  if (!this.nextLot) return '';
  const target = this.nextLot.auctionStartAt ?? this.nextLot.auctionEndAt;
  if (!target) return '';
  const date = new Date(target);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const afterTomorrowStart = new Date(tomorrowStart);
  afterTomorrowStart.setDate(afterTomorrowStart.getDate() + 1);

  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  if (date >= todayStart && date < tomorrowStart) {
    return `Сегодня в ${time}`;
  }
  if (date >= tomorrowStart && date < afterTomorrowStart) {
    return `Завтра в ${time}`;
  }
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} в ${time}`;
}
```

- [ ] **Step 5: Replace the empty state block in live-trading.html**

Find the current empty block (lines 11–17):
```html
@if (!loading && auctionList.length === 0) {
  <div class="live__empty">
    <span class="material-symbols-rounded">gavel</span>
    <h3>No active auctions</h3>
    <p>There are currently no lots in live trading. Check back later.</p>
  </div>
}
```

Replace with:
```html
@if (!loading && auctionList.length === 0) {
  <div class="live__no-auctions">
    <span class="material-symbols-rounded live__no-auctions__icon">gavel</span>
    <h3 class="live__no-auctions__title">Сейчас торгов нет</h3>
    @if (nextLotLoading) {
      <p class="live__no-auctions__sub">Загрузка расписания...</p>
    } @else if (nextLot) {
      <p class="live__no-auctions__sub">
        Следующий аукцион — <strong>{{ getNextLotLabel() }}</strong>
      </p>
      <p class="live__no-auctions__car">{{ nextLot.title }}</p>
    } @else {
      <p class="live__no-auctions__sub">Расписание пока не объявлено</p>
    }
    <a routerLink="/auctions" class="live__no-auctions__link">
      <span class="material-symbols-rounded">calendar_month</span>
      Смотреть расписание
    </a>
  </div>
}
```

- [ ] **Step 6: Add styles to live-trading.scss**

Replace the existing `.live__empty` block (lines 12–36) — keep `.live__loading` as-is, add new `.live__no-auctions` alongside it:

Find:
```scss
.live__loading,
.live__empty {
```
Change to:
```scss
.live__loading {
```
(remove `,.live__empty` — we're replacing the empty state with a new block)

Then add at the end of the "Loading & Empty States" section:
```scss
.live__no-auctions {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-md;
  text-align: center;
  padding: $space-xl;

  &__icon {
    font-size: 56px;
    color: $text-tertiary;
    opacity: 0.5;
  }

  &__title {
    margin: 0;
    font-size: $fs-xl;
    font-weight: $fw-bold;
    color: $text-primary;
  }

  &__sub {
    margin: 0;
    font-size: $fs-base;
    color: $text-secondary;

    strong {
      color: $text-primary;
      font-weight: $fw-semibold;
    }
  }

  &__car {
    margin: 0;
    font-size: $fs-sm;
    color: $text-tertiary;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    gap: $space-xs;
    margin-top: $space-sm;
    padding: $space-sm $space-lg;
    background: $accent;
    color: #FFFFFF;
    border-radius: $radius-base;
    font-size: $fs-sm;
    font-weight: $fw-semibold;
    text-decoration: none;
    transition: opacity $transition-fast;

    .material-symbols-rounded { font-size: 18px; }

    &:hover { opacity: 0.85; }
  }
}
```

- [ ] **Step 7: Commit**
```bash
git add client/src/app/pages/live-trading/live-trading.ts \
        client/src/app/pages/live-trading/live-trading.html \
        client/src/app/pages/live-trading/live-trading.scss
git commit -m "feat(live): show next auction info when no active auctions"
```

---

## Task 3: Rebuild `/auctions` as calendar schedule

**Files:**
- Rewrite: `client/src/app/pages/auctions/auctions.ts`
- Rewrite: `client/src/app/pages/auctions/auctions.html`
- Rewrite: `client/src/app/pages/auctions/auctions.scss`

### Data strategy

- Load the entire current calendar month in one request: `dateFrom=<month-start>&dateTo=<month-end>&limit=500&sort=date_asc`
- Cache fetched months in a `Map<string, ILot[]>` keyed by `"YYYY-MM"` — switching months reuses cache
- Selected day state: `selectedDateKey: string | null` (ISO date string `"YYYY-MM-DD"`)

### Calendar logic

- Build a 7-column grid (Mon–Sun). First cell of the grid = Monday of the week containing the 1st day of the month. Last cell = Sunday of the week containing the last day of the month.
- Each cell: `{ date: Date, inMonth: boolean, lotCount: number }`
- Past days: `isPast = date < today` — greyed out, not clickable
- Days with lots: clickable, show lot count badge

### Steps

- [ ] **Step 1: Rewrite auctions.ts**

Full replacement content:
```typescript
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
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
  imports: [RouterLink, DecimalPipe, DatePipe],
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
    // Count lots per day
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

    // Monday = 0 offset. getDay() returns 0=Sun, 1=Mon...
    // Convert to Mon-based: (getDay() + 6) % 7
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
    return date.toISOString().split('T')[0];
  }
}
```

- [ ] **Step 2: Rewrite auctions.html**

Full replacement content:
```html
<div class="schedule">
  <div class="schedule__header">
    <h1 class="schedule__title">Расписание аукционов</h1>
    <p class="schedule__subtitle">Выберите день, чтобы увидеть лоты</p>
  </div>

  <div class="schedule__calendar">
    <!-- Month navigation -->
    <div class="cal__nav">
      <button class="cal__nav-btn" (click)="prevMonth()">
        <span class="material-symbols-rounded">chevron_left</span>
      </button>
      <span class="cal__month-label">{{ monthLabel }}</span>
      <button class="cal__nav-btn" (click)="nextMonth()">
        <span class="material-symbols-rounded">chevron_right</span>
      </button>
    </div>

    <!-- Weekday headers -->
    <div class="cal__grid">
      @for (day of weekdays; track day) {
        <div class="cal__weekday">{{ day }}</div>
      }

      @if (loading) {
        @for (i of skeletonCells; track i) {
          <div class="cal__cell cal__cell--skeleton"></div>
        }
      } @else {
        @for (cell of cells; track cell.dateKey) {
          <div
            class="cal__cell"
            [class.cal__cell--out]="!cell.inMonth"
            [class.cal__cell--past]="cell.isPast"
            [class.cal__cell--has-lots]="cell.lotCount > 0 && !cell.isPast"
            [class.cal__cell--selected]="selectedDateKey === cell.dateKey"
            (click)="selectDay(cell)"
          >
            <span class="cal__cell-date">{{ cell.date.getDate() }}</span>
            @if (cell.lotCount > 0 && !cell.isPast) {
              <span class="cal__cell-badge">{{ cell.lotCount }}</span>
            }
          </div>
        }
      }
    </div>
  </div>

  <!-- Day detail panel -->
  @if (selectedDateKey && selectedLots.length > 0) {
    <div class="schedule__lots">
      <div class="schedule__lots-header">
        <span class="material-symbols-rounded">calendar_today</span>
        <span>{{ selectedLots.length }} лотов</span>
      </div>
      <div class="schedule__lots-list">
        @for (lot of selectedLots; track lot.id) {
          <a [routerLink]="['/catalog', lot.id]" class="lot-row">
            <div class="lot-row__thumb">
              @if (getMainImage(lot)) {
                <img [src]="getMainImage(lot)" [alt]="lot.title" loading="lazy" class="lot-row__img">
              } @else {
                <span class="material-symbols-rounded">directions_car</span>
              }
            </div>
            <div class="lot-row__info">
              <span class="lot-row__title">{{ lot.title }}</span>
              <div class="lot-row__meta">
                @if (lot.year) { <span>{{ lot.year }}</span> }
                @if (lot.mileage) { <span>{{ lot.mileage | number }} км</span> }
                @if (lot.fuelType) { <span>{{ lot.fuelType }}</span> }
              </div>
            </div>
            <div class="lot-row__right">
              @if (isLotActive(lot)) {
                <span class="lot-row__live-badge">
                  <span class="lot-row__live-dot"></span>
                  Идёт
                </span>
              } @else {
                <span class="lot-row__time">{{ getLotTime(lot) }}</span>
              }
              @if (lot.startingBid) {
                <span class="lot-row__price">{{ lot.startingBid | number }} {{ lot.originalCurrency || 'EUR' }}</span>
              }
              @if (lot.saleCountry) {
                <span class="lot-row__country">{{ lot.saleCountry }}</span>
              }
            </div>
            @if (isLotActive(lot)) {
              <a [routerLink]="['/live']" class="lot-row__join" (click)="$event.stopPropagation()">
                <span class="material-symbols-rounded">gavel</span>
                В торги
              </a>
            }
          </a>
        }
      </div>
    </div>
  }
</div>
```

- [ ] **Step 3: Rewrite auctions.scss**

Full replacement content:
```scss
@use 'styles/variables' as *;
@use 'styles/mixins' as *;

.schedule {
  max-width: 760px;
  margin: 0 auto;
  padding: $space-xl $space-base;

  @include mobile {
    padding: $space-lg $space-base;
  }
}

.schedule__header {
  margin-bottom: $space-xl;
}

.schedule__title {
  margin: 0 0 $space-xs;
  font-size: $fs-2xl;
  font-weight: $fw-bold;
  color: $text-primary;
}

.schedule__subtitle {
  margin: 0;
  font-size: $fs-sm;
  color: $text-secondary;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

.schedule__calendar {
  background: $bg-panel;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  overflow: hidden;
  margin-bottom: $space-lg;
}

.cal__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-md $space-base;
  border-bottom: 1px solid $border-color;
}

.cal__month-label {
  font-size: $fs-base;
  font-weight: $fw-semibold;
  color: $text-primary;
}

.cal__nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: $bg-elevated;
  border: 1px solid $border-color;
  border-radius: $radius-base;
  color: $text-secondary;
  cursor: pointer;
  transition: all $transition-fast;

  .material-symbols-rounded { font-size: 20px; }

  &:hover {
    border-color: $accent;
    color: $accent;
  }
}

.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.cal__weekday {
  padding: $space-sm $space-xs;
  text-align: center;
  font-size: $fs-xs;
  font-weight: $fw-semibold;
  color: $text-tertiary;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid $border-color;
}

.cal__cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-right: 1px solid $divider;
  border-bottom: 1px solid $divider;
  font-size: $fs-sm;
  color: $text-primary;
  transition: background $transition-fast;
  min-height: 56px;

  &:nth-child(7n) { border-right: none; }

  // Outside current month
  &--out {
    color: $text-tertiary;
    background: rgba($bg-primary, 0.5);
  }

  // Past days
  &--past {
    color: $text-tertiary;
    cursor: default;
    .cal__cell-date { opacity: 0.4; }
  }

  // Days with lots
  &--has-lots {
    cursor: pointer;
    &:hover { background: $accent-subtle; }
  }

  // Selected day
  &--selected {
    background: $accent-subtle;
    .cal__cell-date { color: $accent; font-weight: $fw-bold; }
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: $accent;
    }
  }

  // Skeleton loader
  &--skeleton {
    background: $bg-elevated;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.cal__cell-date {
  font-size: $fs-sm;
  line-height: 1;
}

.cal__cell-badge {
  font-size: 10px;
  font-weight: $fw-bold;
  color: $accent;
  background: rgba($accent, 0.12);
  border-radius: $radius-chip;
  padding: 1px 5px;
  line-height: 1.4;
}

// ─── Day detail panel ─────────────────────────────────────────────────────────

.schedule__lots {
  background: $bg-panel;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  overflow: hidden;
  animation: slide-down 0.2s ease-out;
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.schedule__lots-header {
  display: flex;
  align-items: center;
  gap: $space-sm;
  padding: $space-md $space-base;
  border-bottom: 1px solid $border-color;
  font-size: $fs-sm;
  font-weight: $fw-semibold;
  color: $text-primary;

  .material-symbols-rounded { font-size: 18px; color: $accent; }
}

.schedule__lots-list {
  display: flex;
  flex-direction: column;
}

// ─── Lot row ──────────────────────────────────────────────────────────────────

.lot-row {
  display: grid;
  grid-template-columns: 72px 1fr auto auto;
  gap: $space-sm;
  align-items: center;
  padding: $space-sm $space-base;
  border-bottom: 1px solid $divider;
  text-decoration: none;
  color: inherit;
  transition: background $transition-fast;

  &:last-child { border-bottom: none; }
  &:hover { background: $bg-elevated; }

  @include mobile {
    grid-template-columns: 56px 1fr auto;
    .lot-row__join { display: none; }
  }
}

.lot-row__thumb {
  width: 72px;
  height: 54px;
  background: $bg-elevated;
  border-radius: $radius-sm;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .material-symbols-rounded { font-size: 24px; color: $text-tertiary; }

  @include mobile { width: 56px; height: 42px; }
}

.lot-row__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lot-row__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lot-row__title {
  font-size: $fs-sm;
  font-weight: $fw-semibold;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lot-row__meta {
  display: flex;
  gap: $space-sm;
  font-size: $fs-xs;
  color: $text-tertiary;
}

.lot-row__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.lot-row__time {
  font-size: $fs-sm;
  font-weight: $fw-semibold;
  color: $text-primary;
  font-family: $font-mono;
}

.lot-row__price {
  font-size: $fs-xs;
  color: $text-tertiary;
}

.lot-row__country {
  font-size: $fs-xs;
  color: $text-tertiary;
}

.lot-row__live-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: $fs-xs;
  font-weight: $fw-bold;
  color: $status-green;
}

.lot-row__live-dot {
  width: 6px;
  height: 6px;
  background: $status-green;
  border-radius: $radius-round;
  animation: pulse-dot 1s ease-in-out infinite;

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
}

.lot-row__join {
  display: flex;
  align-items: center;
  gap: $space-xs;
  padding: $space-xs $space-sm;
  background: $accent;
  color: #FFFFFF;
  border-radius: $radius-base;
  font-size: $fs-xs;
  font-weight: $fw-semibold;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity $transition-fast;

  .material-symbols-rounded { font-size: 14px; }

  &:hover { opacity: 0.85; }
}
```

- [ ] **Step 4: Build and verify no TypeScript errors**
```bash
cd /Users/maksnalyvaiko/personal/car-auction/client && npx ng build --configuration development 2>&1 | tail -20
```
Expected: build completes with 0 errors. Fix any import or type errors before committing.

- [ ] **Step 5: Commit**
```bash
git add client/src/app/pages/auctions/auctions.ts \
        client/src/app/pages/auctions/auctions.html \
        client/src/app/pages/auctions/auctions.scss
git commit -m "feat(auctions): rebuild as monthly calendar schedule"
```
