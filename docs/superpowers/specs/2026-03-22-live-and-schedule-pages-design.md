# Live Trading & Auction Schedule Pages — Design

**Date:** 2026-03-22

## Problem

The `/live` page (real-time WebSocket trading) exists but is not in the navigation. The `/auctions` page shows a static 3-day schedule but has no real-time features and is wrongly positioned as the primary auctions entry point.

## Goals

1. Restore `/live` as the primary live-trading interface, reachable from the nav
2. Add a meaningful empty state when no auctions are active
3. Rebuild `/auctions` as a calendar-style multi-week schedule page
4. Add both links to the header navigation

---

## Page 1: `/live` — Live Trading (patch)

### Active state (no change)
Full 3-column layout: active lot detail + bid controls | auction list sidebar | global live feed. WebSocket-powered. Already working.

### Empty state (new)
When `auctionList.length === 0` after loading:

- Show informational banner: icon + "Сейчас торгов нет"
- Fetch the next scheduled lot via `GET /lots?status=scheduled&sort=date_asc&limit=1`
- Display: "Следующий аукцион — **[дата/время]**"
  - If today: "Сегодня в 14:00"
  - If tomorrow: "Завтра в 10:00"
  - Otherwise: "Пятница, 27 марта в 09:00"
- Link "Смотреть расписание →" → `/auctions`
- If no upcoming lots found: "Расписание пока не объявлено"

### Data
- Existing: `AuctionService.getActiveLots()`
- New: `LotService.getAll({ status: 'scheduled', sort: 'date_asc', limit: 1 })` — called only when active list is empty

---

## Page 2: `/auctions` — Auction Schedule (rebuild)

### Layout
Calendar grid view:

```
[‹ Март 2026]                              [Апрель 2026 ›]
Пн   Вт   Ср   Чт   Пт   Сб   Вс
 -    -    -   26   27   28   29
               [3]  [5]
30   31    1    2    3    4    5
[2]       [8]
```

- Navigation: prev/next month buttons + current month label
- Each day cell: date number + optional badge with lot count
- Days in the past: greyed out, not clickable
- Days with lots: highlighted, clickable
- Selected day: underlined/highlighted

### Day detail panel
Below the grid, clicking a day with lots reveals a list:
- Each lot: thumbnail | title | `auctionStartAt` time | starting price | country flag
- Clicking a lot → `/catalog/:id`
- If the auction is currently active → button "Войти в торги" → `/live`

### Data
- Load: `GET /lots?dateFrom=<month-start>&dateTo=<month-end>&limit=500&sort=date_asc`
- On month change: re-fetch for new month range
- Two months cached in memory (current + adjacent) to avoid re-fetch on quick navigation

---

## Navigation

Replace single "Аукционы" link in header with two links:

| Label | Route | Position |
|-------|-------|----------|
| Торги | `/live` | before current |
| Расписание | `/auctions` | after |

Same change in mobile drawer menu.

---

## Affected Files

- `client/src/app/pages/live-trading/live-trading.ts` — add empty-state data fetch
- `client/src/app/pages/live-trading/live-trading.html` — replace empty block with banner
- `client/src/app/pages/live-trading/live-trading.scss` — empty state styles
- `client/src/app/pages/auctions/auctions.ts` — full rewrite to calendar component
- `client/src/app/pages/auctions/auctions.html` — full rewrite
- `client/src/app/pages/auctions/auctions.scss` — full rewrite
- `client/src/app/components/header/header.html` — two nav links instead of one
