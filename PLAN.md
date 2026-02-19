# Car Auction — Plan

## Progress Tracking

> Последнее обновление: 2026-02-19

| Фаза | Статус | API | Client | Прогресс |
|------|--------|-----|--------|----------|
| **Фаза 1** — Фундамент | В работе | ~90% | ~85% | █████████░ |
| **Фаза 2** — Каталог и лоты | В работе | ~75% | ~85% | ████████░░ |
| **Фаза 3** — Аукцион (ядро) | В работе | ~75% | ~80% | ████████░░ |
| **Фаза 4** — Личный кабинет | В работе | ~85% | ~85% | █████████░ |
| **Фаза 5** — Уведомления и калькулятор | Не начата | 0% | UI scaffolded | ░░░░░░░░░░ |
| **Фаза 6** — Админ-панель | Не начата | 0% | 0% | ░░░░░░░░░░ |
| **Фаза 7** — Финализация | Не начата | 0% | 0% | ░░░░░░░░░░ |

### Реализованные модули (Backend)

| Модуль | Статус | Endpoints | Примечания |
|--------|--------|-----------|------------|
| `auth` | DONE | signup, login, refresh, logout, OAuth (Google/Yandex/VK/Telegram) | JWT access+refresh, guards, roles |
| `user` | DONE | me, update, list, activate, block | CRUD + менеджерские операции |
| `lot` | DONE (read-only) | list+filters, detail, brands, stats | Нет CRUD для manager, нет CSV import |
| `scraper` | DONE | run, status, runs | BCA Playwright scraper, не в плане |
| `balance` | DONE | balance, transactions, adjust | Transaction lock + SELECT FOR UPDATE |
| `favorites` | DONE | list, add, remove | Composite PK (userId+lotId) |
| `watchlist` | DONE | list, add, remove | По марке/модели/лоту |
| `documents` | DONE | list, upload, detail, status | Manager одобрение |
| `auction` | DONE | placeBid, buyNow, getBids, myBids, activeLots + WebSocket Gateway | Anti-sniping, row-level lock, JWT WS auth, self-bid prevention, balance lock in transaction |
| `order` | DONE | getMyOrders, getAllOrders, getById, updateStatus, tracking | + OrderStatusHistory, status transitions validation, transactional create |
| `notification` | NOT STARTED | — | Email, push, Telegram, in-app |
| `content` | NOT STARTED | — | CMS: отзывы, FAQ, преимущества |
| `calculator` | NOT STARTED | — | Растаможка + полная стоимость |
| `admin` | NOT STARTED | — | Админ-панель |
| `stats` | NOT STARTED | — | Отчёты, экспорт |
| `file` | NOT STARTED | — | S3 upload |

### Реализованные сущности (DB)

| Entity | Статус | Примечания |
|--------|--------|------------|
| `users` | DONE | + OAuth поля (googleId, yandexId, vkId, telegramId) |
| `lots` | DONE (partial) | BCA-адаптированная, 15 полей из плана отсутствуют |
| `lot_images` | DONE | С категориями |
| `refresh_tokens` | DONE | SHA-256 hashing |
| `scraper_runs` | DONE | Не в плане, для BCA scraper |
| `balance_transactions` | DONE | |
| `favorites` | DONE | Composite PK |
| `watchlist` | DONE | |
| `documents` | DONE | |
| `bids` | DONE | UUID, amount, idempotency_key, is_pre_bid, max_auto_bid, lot/user relations |
| `orders` | DONE | carPrice, commission, delivery, customs, total, managerComment |
| `order_status_history` | DONE | status, comment, changedBy, estimatedDate |
| `notifications` | NOT CREATED | |
| `notification_settings` | NOT CREATED | |
| `saved_searches` | NOT CREATED | |
| `reviews` | NOT CREATED | CMS |
| `faq` | NOT CREATED | CMS |
| `advantages` | NOT CREATED | CMS |
| `partners` | NOT CREATED | CMS |
| `pages` | NOT CREATED | CMS |
| `referrals` | NOT CREATED | |

### Frontend — Подключение к API

| Страница | Данные | Примечания |
|----------|--------|------------|
| Home | REAL API | LotService: stats, brands, recent lots |
| Catalog | REAL API | LotService: фильтры, сортировка, пагинация |
| Lot Detail | REAL API | LotService.getById(), галерея |
| Login | REAL API | AuthService, OAuth (Telegram/Google/Yandex/VK) |
| Register | REAL API | AuthService |
| Settings | REAL API (partial) | Профиль через UserService, scraper control |
| Dashboard | REAL API | Баланс, избранное, данные пользователя |
| Balance | REAL API | BalanceService: текущий баланс + транзакции |
| Documents | REAL API | DocumentsService: список, загрузка |
| Watchlist | REAL API | WatchlistService + FavoritesService |
| Live Trading | REAL API + WebSocket | AuctionService + WebsocketService, live feed, bid panel, anti-sniping, OnPush |
| My Bids | REAL API | Tabs: All/Active/Won/Lost, пагинация, статус бейджи |
| Orders | REAL API | OrderService, timeline, статус бейджи, cost breakdown, OnDestroy cleanup |
| Notifications | EMPTY STATE | Ожидает реализации Фазы 5 |
| About | STATIC | Контент |
| FAQ | STATIC | Контент |
| Contacts | STATIC | Форма без submit |

### Известные проблемы / TODO

- [x] ~~Race condition в `balance.service.ts`~~ — FIXED: DB transaction + SELECT FOR UPDATE
- [x] ~~Нет ParseUUIDPipe на route params~~ — FIXED: добавлен на все контроллеры
- [x] ~~Decimal columns возвращаются как string~~ — FIXED: добавлен transformer
- [x] ~~`UpdateDocumentStatusDto` позволяет PENDING~~ — FIXED: только APPROVED/REJECTED
- [x] ~~`fileUrl` без @IsUrl()~~ — FIXED: добавлена валидация
- [x] ~~`isFavorite()` не экспонирован~~ — FIXED: добавлен GET endpoint
- [x] ~~`AddWatchlistItemDto` пустой item~~ — FIXED: валидация минимум 1 поля
- [ ] Нет пагинации в watchlist
- [x] ~~Нет `updatedAt` на Document entity~~ — FIXED
- [x] ~~WS аутентификация — клиент отправлял userId без проверки~~ — FIXED: JWT verify в handleConnection
- [x] ~~WS CORS origin: '*'~~ — FIXED: ограничен до конкретных origin-ов
- [x] ~~Balance race condition в auction (double-spend)~~ — FIXED: SELECT FOR UPDATE внутри транзакции
- [x] ~~Order tracking без проверки владельца~~ — FIXED: ownership check
- [x] ~~createOrder не атомарный~~ — FIXED: QueryRunner transaction
- [x] ~~Нет валидации переходов статусов заказа~~ — FIXED: state machine
- [x] ~~Pagination без верхнего лимита (DoS вектор)~~ — FIXED: Math.min(limit, 100)
- [x] ~~getBidsByLot утекает user relations~~ — FIXED: анонимизированные bidder ID
- [x] ~~Self-bidding возможен~~ — FIXED: ForbiddenException
- [x] ~~Bid eager:true для lot~~ — FIXED: explicit relations
- [x] ~~Global feed подключался к неправильной комнате~~ — FIXED: join_feed/leave_feed handlers
- [x] ~~WS events frontend/backend mismatch~~ — FIXED: модели синхронизированы
- [x] ~~LiveTrading disconnect() убивал singleton WS~~ — FIXED: только leave room
- [x] ~~OrdersComponent без OnDestroy~~ — FIXED: takeUntil(destroy$)
- [x] ~~markForCheck без OnPush~~ — FIXED: ChangeDetectionStrategy.OnPush
- [ ] Lot entity: часть полей из плана отсутствуют (auction_type, bid_step, reserve_price добавлены; нет VIN decode, inspection_report, etc.)
- [ ] Нет Redis — нужен для WebSocket pub/sub и очередей
- [ ] Тема: план — тёмная, реализация — светлая
- [ ] Пагинация offset-based вместо cursor-based
- [ ] Нет forgot-password / reset-password
- [ ] Нет Angular Material (используется custom SCSS)
- [ ] Нет pre-bidding (auto-bid up to max_auto_bid)
- [ ] Нет cron/scheduled task для определения победителя аукциона
- [ ] Нет файлового модуля (S3 upload) для документов

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Angular 20 (standalone components) | SSR via @angular/ssr + Express |
| UI Kit | Angular Material + CDK | Dark theme (deep navy + teal accent) |
| State | RxJS BehaviorSubject (StateService) | По аналогии с car-client-angular |
| Realtime (FE) | socket.io-client | Ставки, Live Feed, уведомления |
| Backend | NestJS 11 | Modular architecture |
| ORM | TypeORM | Migrations (synchronize: false в prod) |
| Database | PostgreSQL | Railway native, надёжнее MySQL для финансов и конкурентных ставок |
| Cache / Queues | Redis | Сессии, кэш каталога, очередь уведомлений, pub/sub для WebSocket |
| Realtime (BE) | @nestjs/websockets + Socket.IO | Каналы: auction:{lot_id}, feed:global, stats:live, watchlist:{user_id} |
| Auth | Passport + JWT | Access + Refresh tokens |
| File Storage | S3 (Railway Volume или Cloudflare R2) | Фото авто, документы |
| i18n | @angular/localize или ngx-translate | RU, UA, EN |
| Hosting | Railway | Nixpacks build, auto-restart |

### Почему PostgreSQL, а не MySQL

- Нативная поддержка Railway (managed PostgreSQL + auto-backups)
- JSONB для гибких полей (спецификации авто, мета-данные лотов)
- Row-level locking — критично для конкурентных ставок
- Лучшая поддержка в TypeORM для миграций
- Full-text search из коробки (каталог)

---

## Структура монорепо

```
car-auction/
├── client/                    # Angular 20 SSR
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/          # Guards, interceptors, auth
│   │   │   ├── shared/        # Pipes, directives, UI-компоненты
│   │   │   ├── models/        # Interfaces (ILot, IUser, IBid, IOrder...)
│   │   │   ├── services/      # API-сервисы, StateService, WebSocket
│   │   │   ├── pages/         # Smart-компоненты (роуты)
│   │   │   │   ├── home/
│   │   │   │   ├── catalog/
│   │   │   │   ├── lot-detail/
│   │   │   │   ├── live-trading/
│   │   │   │   ├── cabinet/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── my-bids/
│   │   │   │   │   ├── orders/
│   │   │   │   │   ├── documents/
│   │   │   │   │   ├── balance/
│   │   │   │   │   ├── watchlist/
│   │   │   │   │   ├── notifications/
│   │   │   │   │   └── settings/
│   │   │   │   ├── auth/
│   │   │   │   ├── about/
│   │   │   │   ├── faq/
│   │   │   │   └── contacts/
│   │   │   └── components/    # Dumb/presentational
│   │   │       ├── header/
│   │   │       ├── footer/
│   │   │       ├── lot-card/
│   │   │       ├── bid-panel/
│   │   │       ├── timer/
│   │   │       ├── calculator/
│   │   │       ├── damage-diagram/
│   │   │       └── ...
│   │   ├── assets/
│   │   ├── environments/
│   │   └── styles/            # Global SCSS, тема, переменные
│   ├── server.ts              # Express SSR entry
│   ├── angular.json
│   └── package.json
│
├── api/                       # NestJS 11
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/          # Login, signup, JWT, guards, refresh tokens
│   │   │   ├── user/          # CRUD пользователей, верификация, флаги
│   │   │   ├── lot/           # CRUD лотов, фильтрация, поиск
│   │   │   ├── auction/       # Аукционная механика, ставки, anti-sniping
│   │   │   ├── order/         # Заказы, статусы, трекинг
│   │   │   ├── balance/       # Баланс, транзакции, блокировка депозита
│   │   │   ├── document/      # Загрузка/управление документами
│   │   │   ├── notification/  # Email, push, Telegram, in-app
│   │   │   ├── watchlist/     # Отслеживание марок/моделей
│   │   │   ├── content/       # CMS: отзывы, FAQ, преимущества, партнёры
│   │   │   ├── calculator/    # Калькулятор растаможки + полной стоимости
│   │   │   ├── admin/         # Админ-панель, управление менеджерами
│   │   │   ├── stats/         # Статистика, отчёты, экспорт
│   │   │   └── file/          # Upload в S3, обработка изображений
│   │   ├── db/
│   │   │   ├── entities/      # TypeORM entities
│   │   │   └── migrations/    # TypeORM migrations
│   │   ├── dtos/              # Валидация входных данных
│   │   ├── common/            # Декораторы, фильтры, pipes
│   │   └── app.module.ts
│   ├── railway.json
│   └── package.json
│
└── PLAN.md
```

---

## Схема базы данных (PostgreSQL)

### Core Entities

```
users
├── id (UUID, PK)
├── email (UNIQUE)
├── password_hash
├── first_name
├── last_name
├── phone
├── country_flag (varchar) — код страны для флага
├── role (enum: client, manager, admin)
├── status (enum: pending, active, blocked)
├── is_verified (boolean)
├── preferred_language (enum: ru, ua, en)
├── preferred_currency (enum: EUR, USD, UAH)
├── referral_code (UNIQUE)
├── referred_by (FK → users.id)
├── created_at
└── updated_at

lots
├── id (UUID, PK)
├── title
├── brand
├── model
├── year
├── mileage
├── mileage_status (enum: actual, not_actual, exempt)
├── fuel_type (enum: petrol, diesel, hybrid, electric)
├── transmission (enum: automatic, manual)
├── drivetrain (enum: fwd, rwd, awd)
├── body_type (enum: sedan, hatchback, suv, wagon, coupe, cabrio, minivan)
├── engine_volume
├── engine_power
├── exterior_color
├── interior_color
├── country_of_origin
├── vin
├── document_status (enum: clean, salvage, rebuilt, parts_only)
├── damage_type (enum: none, front, rear, side, flood, fire, vandalism)
├── condition (enum: run_and_drive, enhanced, stationary)
├── description (TEXT)
├── damage_diagram (JSONB) — зоны повреждений для визуализации
├── specs (JSONB) — доп. характеристики
├── video_url
├── auction_type (enum: timed, buy_now, both)
├── start_price (DECIMAL)
├── buy_now_price (DECIMAL, nullable)
├── reserve_price (DECIMAL, nullable)
├── bid_step (DECIMAL)
├── auction_start_at (TIMESTAMP)
├── auction_end_at (TIMESTAMP)
├── status (enum: draft, active, trading, sold, cancelled)
├── created_by (FK → users.id, менеджер)
├── winner_id (FK → users.id, nullable)
├── created_at
├── updated_at
└── deleted_at (soft delete)

bids
├── id (UUID, PK)
├── lot_id (FK → lots.id)
├── user_id (FK → users.id)
├── amount (DECIMAL)
├── is_pre_bid (boolean)
├── max_auto_bid (DECIMAL, nullable) — для pre-bidding
├── idempotency_key (UNIQUE) — защита от дублей
├── created_at
└── INDEX (lot_id, amount DESC) — быстрый поиск текущей макс. ставки

orders
├── id (UUID, PK)
├── lot_id (FK → lots.id)
├── user_id (FK → users.id)
├── status (enum: pending, approved, paid, delivered_svh, customs, cleared, delivering, completed)
├── car_price (DECIMAL)
├── commission (DECIMAL)
├── delivery_cost (DECIMAL)
├── customs_cost (DECIMAL)
├── total (DECIMAL)
├── manager_comment (TEXT)
├── created_at
└── updated_at

order_status_history
├── id (UUID, PK)
├── order_id (FK → orders.id)
├── status (enum)
├── comment
├── changed_by (FK → users.id)
├── created_at
└── estimated_date (nullable)

balance_transactions
├── id (UUID, PK)
├── user_id (FK → users.id)
├── type (enum: deposit, car_payment, commission, delivery, customs, refund)
├── amount (DECIMAL) — положительный/отрицательный
├── balance_after (DECIMAL)
├── description
├── order_id (FK → orders.id, nullable)
├── created_by (FK → users.id, менеджер)
└── created_at

documents
├── id (UUID, PK)
├── user_id (FK → users.id)
├── order_id (FK → orders.id, nullable)
├── type (enum: passport, power_of_attorney, invoice, customs_doc, other)
├── status (enum: pending, approved, rejected)
├── file_url
├── file_name
├── uploaded_by (FK → users.id)
└── created_at

lot_images
├── id (UUID, PK)
├── lot_id (FK → lots.id)
├── url
├── category (enum: main, exterior, interior, damage, document)
├── sort_order
└── created_at

notifications
├── id (UUID, PK)
├── user_id (FK → users.id)
├── type (enum: outbid, auction_starting, auction_ended, order_status, document, new_lot_match, balance_changed, action_required)
├── priority (enum: low, medium, high)
├── title
├── message
├── data (JSONB) — контекст (lot_id, order_id и т.д.)
├── is_read (boolean)
├── channels_sent (JSONB) — ["email", "push", "telegram"]
└── created_at

notification_settings
├── id (UUID, PK)
├── user_id (FK → users.id, UNIQUE)
├── settings (JSONB) — { "outbid": { "email": true, "push": true, "telegram": false }, ... }
└── updated_at

saved_searches
├── id (UUID, PK)
├── user_id (FK → users.id)
├── name
├── filters (JSONB) — сохранённый набор фильтров
├── is_active (boolean)
└── created_at

watchlist
├── id (UUID, PK)
├── user_id (FK → users.id)
├── lot_id (FK → lots.id, nullable) — конкретный лот
├── brand (nullable) — подписка на марку
├── model (nullable) — подписка на модель
└── created_at

favorites (лайки)
├── user_id (FK → users.id)
├── lot_id (FK → lots.id)
├── created_at
└── PK (user_id, lot_id)

reviews
├── id (UUID, PK)
├── client_name
├── client_photo_url
├── text
├── rating (1-5)
├── is_published (boolean)
├── sort_order
└── created_at

faq
├── id (UUID, PK)
├── question
├── answer
├── sort_order
├── is_published (boolean)
└── created_at

advantages
├── id (UUID, PK)
├── icon
├── title
├── description
├── sort_order
└── created_at

partners
├── id (UUID, PK)
├── name
├── logo_url
├── website_url
├── sort_order
└── created_at

pages (CMS)
├── id (UUID, PK)
├── slug (UNIQUE)
├── title
├── content (TEXT, HTML)
└── updated_at

referrals
├── id (UUID, PK)
├── referrer_id (FK → users.id)
├── referred_id (FK → users.id)
├── bonus_amount (DECIMAL, nullable)
├── status (enum: registered, first_purchase, bonus_paid)
└── created_at
```

---

## Фазы реализации

### Фаза 1 — Фундамент (~80%)

**API:**
- [x] Инициализация NestJS проекта (TypeORM, PostgreSQL) ~~Redis~~ (Redis не настроен)
- [x] Модуль `auth`: регистрация, логин, JWT (access + refresh), guards, roles decorator
- [x] Модуль `user`: CRUD, верификация, активация менеджером, смена флага
- [ ] Модуль `file`: загрузка файлов в S3/Volume, обработка изображений
- [x] Entity-модели (synchronize, миграции пока нет)
- [x] railway.json, CORS, ValidationPipe, глобальные фильтры ошибок
- [x] OAuth: Google, Yandex, VK, Telegram
- [ ] Forgot password / reset password

**Client:**
- [x] Инициализация Angular 20 с SSR (@angular/ssr + Express)
- [x] Дизайн-система: SCSS-переменные, Manrope + Space Mono (светлая тема вместо тёмной)
- [ ] Angular Material dark theme configuration (не используется, custom SCSS)
- [x] Core: ApiService, HttpInterceptor (JWT attach + refresh), AuthGuard
- [x] StateService (BehaviorSubject)
- [x] Layout: Header, Footer
- [x] Страницы: Auth (login, register) — подключены к API
- [ ] Forgot password страница
- [x] Routing skeleton (lazy loading)

**Infra:**
- [x] Railway: PostgreSQL, два сервиса (api, client)
- [ ] Redis (не настроен)
- [x] Переменные окружения

---

### Фаза 2 — Каталог и лоты (~75%)

**API:**
- [x] Модуль `lot`: чтение лотов, фильтрация, статистика, бренды
- [ ] Модуль `lot`: CRUD для manager (POST, PATCH, DELETE)
- [ ] Модуль `lot`: CSV import
- [x] Фильтрация и поиск (QueryBuilder с динамическими фильтрами)
- [x] Пагинация (offset-based, не cursor-based)
- [x] Сортировка (цена, дата, год, пробег)
- [ ] Модуль `content`: CRUD для отзывов, FAQ, преимуществ, партнёров, страниц
- [x] **EXTRA**: Модуль `scraper` — BCA Playwright scraper для импорта лотов

**Client:**
- [x] Главная страница: Hero, преимущества, превью каталога, как это работает, FAQ (подключена к API)
- [x] Каталог: фильтры, сортировка, карточки лотов (подключен к LotService)
- [ ] Каталог: infinite scroll (сейчас offset пагинация)
- [x] Детальная страница лота: галерея, спецификации, VIN (подключена к API)
- [ ] Детальная страница лота: видео, схема повреждений, документы
- [ ] Сохранённые поиски
- [ ] SEO: мета-теги, OG, SSR для каталога

---

### Фаза 3 — Аукцион (ядро) (~40% — Backend DONE, Frontend TODO)

**API:**
- [x] Модуль `auction`:
  - [x] WebSocket Gateway (Socket.IO): каналы auction:{lot_id}, feed:global
  - [x] Приём ставок: валидация (баланс, шаг, idempotency key) + DB transaction + row-level locking
  - [x] Anti-sniping: продление на +2 мин при ставке в последние 30 сек
  - [ ] Pre-bidding: автоматическое повышение ставки до max_auto_bid
  - [x] Buy Now: мгновенная покупка с проверкой баланса
  - [ ] Определение победителя по завершении таймера (cron/scheduled task)
  - [ ] Блокировка депозита при активной ставке
  - [x] Логирование всех ставок с timestamps
- [x] Bid entity создана (UUID, amount, idempotency_key, is_pre_bid, max_auto_bid)
- [x] Lot entity расширена (auctionType, bidStep, reservePrice, auctionStartAt, auctionEndAt, currentPrice, winnerId, createdBy)
- [x] AuctionType enum (TIMED, BUY_NOW, BOTH)
- [x] API endpoints: POST /bids, POST /bids/buy-now, GET /bids/lot/:id, GET /bids/my, GET /auction/active
- [ ] Redis pub/sub для масштабирования WebSocket между инстансами
- [x] Модуль `balance`: просмотр баланса, история транзакций — **DONE** (+ race condition fix с transaction lock)

**Client:**
- [ ] Страница Live-торгов: трёхколоночный layout (UI scaffolded, mock data)
- [ ] WebSocket-сервис (подключение, реконнект, подписки на каналы)
- [ ] Bid Panel: quick-bid кнопки (+100, +250, +500, +1000), произвольная ставка, Buy Now
- [ ] Optimistic UI: мгновенное обновление → подтверждение/откат
- [ ] Таймер с цветовой индикацией (зелёный → жёлтый → красный + пульсация)
- [ ] Анимации ставок (каскад по ТЗ: scale, bounce, flash, float)
- [ ] Адаптивность: desktop (3 колонки) → tablet (2) → mobile (1 + табы)
- [ ] Статистическая панель (активные аукционы, онлайн, объём, ставки)

---

### Фаза 4 — Личный кабинет (~55%)

**API:**
- [ ] Модуль `order`: создание заказа после победы, статусы, история, чекпойнты доставки
- [x] Модуль `document`: CRUD, статусы (pending/approved/rejected), привязка к заказу — **DONE**
- [x] Расширение `user`: профиль (PATCH /users/me) — **DONE**
- [ ] Расширение `user`: дашборд-данные, настройки уведомлений
- [x] Модуль `watchlist`: подписки на марки/модели — **DONE**
- [ ] Модуль `watchlist`: проверка при создании лота
- [x] Модуль `favorites`: добавление/удаление лотов — **DONE** (не в оригинальном плане фазы)

**Client:**
- [x] Дашборд: баланс, избранное, данные пользователя (подключен к API)
- [ ] Дашборд: активные ставки, статус заказов, уведомления (ожидает Фазу 3)
- [ ] Мои ставки: вкладки (ожидает Фазу 3, empty state)
- [ ] Заказы: прогресс-бар/таймлайн (empty state)
- [x] Документы: список, статусы (подключены к API)
- [ ] Документы: загрузка файлов (нужен модуль file)
- [x] Баланс: текущий + история транзакций (подключен к API)
- [ ] Баланс: выгрузка инвойсов PDF
- [x] Отслеживаемые лоты / favorites (подключены к API)
- [x] Watchlist: список (подключен к API)
- [ ] Watchlist: chip-бар + модалка выбора марок/моделей
- [x] Настройки: профиль (подключен к UserService)
- [ ] Настройки: флаг, язык, валюта, каналы уведомлений

---

### Фаза 5 — Уведомления и калькулятор (0% — НЕ НАЧАТА)

**API:**
- [ ] Модуль `notification`:
  - [ ] Email (SES/SMTP)
  - [ ] Push-уведомления (Web Push API)
  - [ ] Telegram-бот (опционально)
  - [ ] In-app (через WebSocket + БД)
  - [ ] Очередь через Redis (Bull/BullMQ) для асинхронной отправки
  - [ ] Настройки каналов по типам уведомлений
- [ ] Модуль `calculator`: растаможка (пошлина, НДС, акциз, утилизационный сбор), полная стоимость

**Client:**
- [ ] Центр уведомлений (колокольчик в хедере, список, mark as read) — UI scaffolded, empty state
- [ ] Push-уведомления (Service Worker)
- [ ] Настройки уведомлений (матрица: тип × канал)
- [ ] Калькулятор растаможки (форма + результат)
- [ ] Калькулятор полной стоимости на странице лота

---

### Фаза 6 — Админ-панель (0% — НЕ НАЧАТА)

**API:**
- [ ] Модуль `admin`:
  - [ ] Управление лотами (CRUD, массовый импорт CSV, расписание аукционов)
  - [ ] Управление пользователями (активация, блокировка, изменение баланса)
  - [ ] Управление заказами (смена статуса, комментарии, документы)
  - [ ] Управление контентом (отзывы, FAQ, преимущества, партнёры, страницы)
  - [ ] Управление документами (реестр, смена статуса)
  - [ ] Управление менеджерами (только admin)
  - [ ] Настройки платформы (депозит, комиссии, anti-sniping, шаблоны уведомлений)
- [ ] Модуль `stats`: финансовые отчёты, экспорт Excel/CSV

**Client (отдельный lazy-loaded route `/admin`):**
- [ ] Лоты: таблица, формы создания/редактирования, загрузка медиа
- [ ] Пользователи: список, профиль, баланс, ставки, заказы
- [ ] Заказы: список, смена статуса, комментарии
- [ ] Контент: WYSIWYG-редактор для страниц
- [ ] Документы: реестр, фильтры, одобрение/отклонение
- [ ] Финансы: дашборд, отчёты, экспорт
- [ ] Настройки платформы

---

### Фаза 7 — Финализация (0% — НЕ НАЧАТА)

- [ ] i18n (RU, UA, EN)
- [ ] Мультивалютность (EUR, USD, UAH, API курсов)
- [ ] Реферальная программа
- [ ] SEO-аудит: sitemap.xml, robots.txt, structured data
- [ ] Performance: lazy loading изображений, CDN, Redis-кэширование каталога
- [ ] Безопасность: rate limiting, CSRF, XSS-защита, аудит-лог
- [ ] Тесты: unit (Jest/Jasmine), e2e (Cypress/Playwright)
- [ ] CI/CD: GitHub Actions → Railway auto-deploy
- [ ] Мониторинг: логирование, health checks

---

## API Endpoints (основные)

### Auth
```
POST   /api/auth/signup              ✅ DONE
POST   /api/auth/login               ✅ DONE
POST   /api/auth/refresh             ✅ DONE
POST   /api/auth/logout              ✅ DONE (не в плане, добавлено)
GET    /api/auth/:provider            ✅ DONE (OAuth redirect)
GET    /api/auth/:provider/callback   ✅ DONE (OAuth callback)
POST   /api/auth/telegram            ✅ DONE (Telegram HMAC)
POST   /api/auth/forgot-password     ❌ TODO
POST   /api/auth/reset-password      ❌ TODO
```

### Users
```
GET    /api/users/me                 ✅ DONE
PATCH  /api/users/me                 ✅ DONE
PATCH  /api/users/me/flag            ❌ TODO
PATCH  /api/users/me/settings        ❌ TODO
GET    /api/users/:id          (mgr) ✅ DONE
GET    /api/users              (mgr) ✅ DONE
PATCH  /api/users/:id/activate (mgr) ✅ DONE
PATCH  /api/users/:id/block    (mgr) ✅ DONE
```

### Lots
```
GET    /api/lots               ✅ DONE (каталог с фильтрами)
GET    /api/lots/:id           ✅ DONE
GET    /api/lots/brands        ✅ DONE (не в плане, добавлено)
GET    /api/lots/stats         ✅ DONE (не в плане, добавлено)
POST   /api/lots         (mgr) ❌ TODO
PATCH  /api/lots/:id     (mgr) ❌ TODO
DELETE /api/lots/:id     (mgr) ❌ TODO
POST   /api/lots/import  (mgr) ❌ TODO (CSV)
```

### Scraper (не в плане, добавлено)
```
POST   /api/scraper/run        ✅ DONE (admin)
GET    /api/scraper/status     ✅ DONE (admin)
GET    /api/scraper/runs       ✅ DONE
GET    /api/scraper/runs/:id   ✅ DONE
```

### Auction / Bids
```
POST   /api/bids               ✅ DONE (ставка + anti-sniping + row-level lock)
POST   /api/bids/buy-now       ✅ DONE (мгновенная покупка)
GET    /api/bids/lot/:lotId    ✅ DONE (история ставок лота)
GET    /api/bids/my            ✅ DONE (мои ставки)
GET    /api/auction/active     ✅ DONE (активные аукционы, не в плане)
```

### Orders
```
GET    /api/orders              ❌ TODO
GET    /api/orders/:id          ❌ TODO
PATCH  /api/orders/:id/status   ❌ TODO (manager+)
GET    /api/orders/:id/tracking ❌ TODO
```

### Balance
```
GET    /api/balance                  ✅ DONE
GET    /api/balance/transactions     ✅ DONE
POST   /api/balance/:userId/adjust   ✅ DONE (manager+)
GET    /api/balance/invoice/:txId    ❌ TODO (PDF)
```

### Documents
```
POST   /api/documents                ✅ DONE
GET    /api/documents                ✅ DONE
GET    /api/documents/:id            ✅ DONE
PATCH  /api/documents/:id/status     ✅ DONE (manager+)
```

### Notifications
```
GET    /api/notifications            ❌ TODO
PATCH  /api/notifications/:id/read   ❌ TODO
PATCH  /api/notifications/read-all   ❌ TODO
GET    /api/notifications/settings   ❌ TODO
PATCH  /api/notifications/settings   ❌ TODO
```

### Watchlist
```
GET    /api/watchlist                ✅ DONE
POST   /api/watchlist                ✅ DONE
DELETE /api/watchlist/:id            ✅ DONE
```

### Favorites
```
GET    /api/favorites                ✅ DONE
POST   /api/favorites/:lotId         ✅ DONE
DELETE /api/favorites/:lotId         ✅ DONE
```

### Saved Searches
```
GET    /api/saved-searches           ❌ TODO
POST   /api/saved-searches           ❌ TODO
DELETE /api/saved-searches/:id       ❌ TODO
```

### Content (public)
```
GET    /api/content/reviews          ❌ TODO
GET    /api/content/faq              ❌ TODO
GET    /api/content/advantages       ❌ TODO
GET    /api/content/partners         ❌ TODO
GET    /api/content/pages/:slug      ❌ TODO
```

### Calculator
```
POST   /api/calculator/customs       ❌ TODO
POST   /api/calculator/total-cost    ❌ TODO
```

### Admin
```
GET    /api/admin/stats              ❌ TODO
GET    /api/admin/reports/export     ❌ TODO
POST   /api/admin/managers    (adm)  ❌ TODO
PATCH  /api/admin/settings           ❌ TODO
GET    /api/admin/documents          ❌ TODO
```

### WebSocket Events
```
# Client → Server
join_auction(lot_id)
leave_auction(lot_id)
place_bid({ lot_id, amount, idempotency_key })

# Server → Client
bid_update({ lot_id, amount, bidder_flag, bidder_id, timestamp })
auction_extended({ lot_id, new_end_at })
auction_ended({ lot_id, winner_id, final_price })
feed_update({ lot_title, amount, bidder_flag, timestamp })
stats_update({ active_auctions, users_online, daily_volume, daily_bids })
watchlist_match({ lot_id, brand, model })
notification({ type, title, message, data })
```

---

## WebSocket Architecture

```
Client (Angular)
    │
    ├─ socket.io-client
    │
    └──► NestJS Gateway (Socket.IO)
              │
              ├─ Redis Adapter (pub/sub)
              │    └─ Масштабирование на несколько инстансов
              │
              ├─ Channels:
              │    ├─ auction:{lot_id}    — ставки, продление, завершение
              │    ├─ feed:global         — Live Feed всех ставок
              │    ├─ stats:live          — статистика в реальном времени
              │    └─ watchlist:{user_id} — совпадения по подпискам
              │
              └─ Bull Queue (Redis)
                   └─ Отложенные задачи: email, push, telegram
```

---

## Deployment (Railway)

```
Railway Project: car-auction
├── Service: api (NestJS)
│   ├── Build: Nixpacks
│   ├── Start: npm run start:prod
│   └── Env: DATABASE_URL, REDIS_URL, JWT_SECRET, S3_*
│
├── Service: client (Angular SSR)
│   ├── Build: Nixpacks (npm run build && npm run serve:ssr)
│   ├── Start: node dist/client/server/server.mjs
│   └── Env: API_URL, PORT
│
├── PostgreSQL (managed)
│   └── Auto-backups
│
└── Redis (managed)
    └── Cache + pub/sub + queues
```
