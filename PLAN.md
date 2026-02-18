# Car Auction — Plan

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

### Фаза 1 — Фундамент

**API:**
- Инициализация NestJS проекта (TypeORM, PostgreSQL, Redis)
- Модуль `auth`: регистрация, логин, JWT (access + refresh), guards, roles decorator
- Модуль `user`: CRUD, верификация, активация менеджером, смена флага
- Модуль `file`: загрузка файлов в S3/Volume, обработка изображений
- Entity-модели + первые миграции
- railway.json, CORS, ValidationPipe, глобальные фильтры ошибок

**Client:**
- Инициализация Angular 20 с SSR (@angular/ssr + Express)
- Дизайн-система: SCSS-переменные, тёмная тема (#0c1926 / #111e2e / #36e4b8), Manrope + Space Mono
- Angular Material dark theme configuration
- Core: AuthService, HttpInterceptor (JWT attach + refresh), AuthGuard
- StateService (BehaviorSubject)
- Layout: Header (48px compact), Footer
- Страницы: Auth (login, register, forgot password)
- Routing skeleton (lazy loading)

**Infra:**
- Railway: PostgreSQL, Redis, два сервиса (api, client)
- Переменные окружения

---

### Фаза 2 — Каталог и лоты

**API:**
- Модуль `lot`: CRUD лотов, загрузка фото/видео, статусы
- Фильтрация и поиск (QueryBuilder с динамическими фильтрами)
- Пагинация (cursor-based для infinite scroll)
- Сортировка (цена, дата, год, пробег, время до конца, кол-во ставок)
- Модуль `content`: CRUD для отзывов, FAQ, преимуществ, партнёров, страниц

**Client:**
- Главная страница: Hero (Stacked Cards), преимущества, превью каталога, как это работает, отзывы, FAQ, партнёры
- Каталог: фильтры (основные + расширенные), сортировка, карточки лотов, infinite scroll
- Детальная страница лота: галерея, видео, спецификации, схема повреждений, документы, VIN
- Сохранённые поиски
- SEO: мета-теги, OG, SSR для каталога

---

### Фаза 3 — Аукцион (ядро)

**API:**
- Модуль `auction`:
  - WebSocket Gateway (Socket.IO): каналы auction:{lot_id}, feed:global, stats:live
  - Приём ставок: валидация (баланс, депозит, шаг, idempotency key, debounce)
  - Anti-sniping: продление на +2 мин при ставке в последние 30 сек
  - Pre-bidding: автоматическое повышение ставки до max_auto_bid
  - Buy Now: мгновенная покупка с проверкой баланса
  - Определение победителя по завершении таймера (cron/scheduled task)
  - Блокировка депозита при активной ставке
  - Логирование всех ставок с timestamps
- Redis pub/sub для масштабирования WebSocket между инстансами
- Модуль `balance`: просмотр баланса, история транзакций (управление — только менеджер)

**Client:**
- Страница Live-торгов: трёхколоночный layout (активный лот + список аукционов + Live Feed)
- WebSocket-сервис (подключение, реконнект, подписки на каналы)
- Bid Panel: quick-bid кнопки (+100, +250, +500, +1000), произвольная ставка, Buy Now
- Optimistic UI: мгновенное обновление → подтверждение/откат
- Таймер с цветовой индикацией (зелёный → жёлтый → красный + пульсация)
- Анимации ставок (каскад по ТЗ: scale, bounce, flash, float)
- Адаптивность: desktop (3 колонки) → tablet (2) → mobile (1 + табы)
- Статистическая панель (активные аукционы, онлайн, объём, ставки)

---

### Фаза 4 — Личный кабинет

**API:**
- Модуль `order`: создание заказа после победы, статусы, история, чекпойнты доставки
- Модуль `document`: CRUD, статусы (pending/approved/rejected), привязка к заказу
- Расширение `user`: дашборд-данные, настройки уведомлений, профиль
- Модуль `watchlist`: подписки на марки/модели, проверка при создании лота

**Client:**
- Дашборд: баланс, активные ставки, статус заказов, уведомления
- Мои ставки: вкладки (активные / выигранные / проигранные)
- Заказы: прогресс-бар/таймлайн статусов, чекпойнты доставки
- Документы: загрузка, список, статусы
- Баланс: текущий + история транзакций + выгрузка инвойсов PDF
- Отслеживаемые лоты (favorites)
- Watchlist: chip-бар + модалка выбора марок/моделей
- Настройки: профиль, флаг, язык, валюта, каналы уведомлений

---

### Фаза 5 — Уведомления и калькулятор

**API:**
- Модуль `notification`:
  - Email (SES/SMTP)
  - Push-уведомления (Web Push API)
  - Telegram-бот (опционально)
  - In-app (через WebSocket + БД)
  - Очередь через Redis (Bull/BullMQ) для асинхронной отправки
  - Настройки каналов по типам уведомлений
- Модуль `calculator`: растаможка (пошлина, НДС, акциз, утилизационный сбор), полная стоимость

**Client:**
- Центр уведомлений (колокольчик в хедере, список, mark as read)
- Push-уведомления (Service Worker)
- Настройки уведомлений (матрица: тип × канал)
- Калькулятор растаможки (форма + результат)
- Калькулятор полной стоимости на странице лота

---

### Фаза 6 — Админ-панель

**API:**
- Модуль `admin`:
  - Управление лотами (CRUD, массовый импорт CSV, расписание аукционов)
  - Управление пользователями (активация, блокировка, изменение баланса)
  - Управление заказами (смена статуса, комментарии, документы)
  - Управление контентом (отзывы, FAQ, преимущества, партнёры, страницы)
  - Управление документами (реестр, смена статуса)
  - Управление менеджерами (только admin)
  - Настройки платформы (депозит, комиссии, anti-sniping, шаблоны уведомлений)
- Модуль `stats`: финансовые отчёты, экспорт Excel/CSV

**Client (отдельный lazy-loaded route `/admin`):**
- Лоты: таблица, формы создания/редактирования, загрузка медиа
- Пользователи: список, профиль, баланс, ставки, заказы
- Заказы: список, смена статуса, комментарии
- Контент: WYSIWYG-редактор для страниц
- Документы: реестр, фильтры, одобрение/отклонение
- Финансы: дашборд, отчёты, экспорт
- Настройки платформы

---

### Фаза 7 — Финализация

- i18n (RU, UA, EN)
- Мультивалютность (EUR, USD, UAH, API курсов)
- Реферальная программа
- SEO-аудит: sitemap.xml, robots.txt, structured data
- Performance: lazy loading изображений, CDN, Redis-кэширование каталога
- Безопасность: rate limiting, CSRF, XSS-защита, аудит-лог
- Тесты: unit (Jest/Jasmine), e2e (Cypress/Playwright)
- CI/CD: GitHub Actions → Railway auto-deploy
- Мониторинг: логирование, health checks

---

## API Endpoints (основные)

### Auth
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

### Users
```
GET    /api/users/me
PATCH  /api/users/me
PATCH  /api/users/me/flag
PATCH  /api/users/me/settings
GET    /api/users/:id          (manager+)
GET    /api/users              (manager+)
PATCH  /api/users/:id/activate (manager+)
PATCH  /api/users/:id/block    (manager+)
```

### Lots
```
GET    /api/lots               (каталог с фильтрами)
GET    /api/lots/:id
POST   /api/lots               (manager+)
PATCH  /api/lots/:id           (manager+)
DELETE /api/lots/:id           (manager+)
POST   /api/lots/import        (manager+, CSV)
```

### Auction / Bids
```
POST   /api/bids               (сделать ставку)
POST   /api/bids/buy-now       (мгновенная покупка)
GET    /api/bids/lot/:lotId    (история ставок лота)
GET    /api/bids/my            (мои ставки)
```

### Orders
```
GET    /api/orders              (мои заказы / все для manager+)
GET    /api/orders/:id
PATCH  /api/orders/:id/status  (manager+)
GET    /api/orders/:id/tracking
```

### Balance
```
GET    /api/balance
GET    /api/balance/transactions
POST   /api/balance/:userId/adjust (manager+)
GET    /api/balance/invoice/:txId  (PDF)
```

### Documents
```
POST   /api/documents
GET    /api/documents
GET    /api/documents/:id
PATCH  /api/documents/:id/status (manager+)
```

### Notifications
```
GET    /api/notifications
PATCH  /api/notifications/:id/read
PATCH  /api/notifications/read-all
GET    /api/notifications/settings
PATCH  /api/notifications/settings
```

### Watchlist
```
GET    /api/watchlist
POST   /api/watchlist
DELETE /api/watchlist/:id
```

### Favorites
```
GET    /api/favorites
POST   /api/favorites/:lotId
DELETE /api/favorites/:lotId
```

### Saved Searches
```
GET    /api/saved-searches
POST   /api/saved-searches
DELETE /api/saved-searches/:id
```

### Content (public)
```
GET    /api/content/reviews
GET    /api/content/faq
GET    /api/content/advantages
GET    /api/content/partners
GET    /api/content/pages/:slug
```

### Calculator
```
POST   /api/calculator/customs
POST   /api/calculator/total-cost
```

### Admin
```
GET    /api/admin/stats
GET    /api/admin/reports/export
POST   /api/admin/managers       (admin only)
PATCH  /api/admin/settings
GET    /api/admin/documents
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
