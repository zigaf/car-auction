# Email System Design

**Date:** 2026-03-22
**Project:** RB Motors — Car Auction Platform
**Sending address:** support@rbimport.com
**Provider:** Resend (API-based, domain verified via DNS at registrar)

---

## Overview

A configurable transactional email system with:
- Resend SDK for delivery
- Handlebars templates stored in PostgreSQL
- Admin UI to manage templates, languages, and event toggles
- Email verification and password reset flows
- Integration with auction, order, and balance events

---

## Architecture

```
NestJS API
├── EmailModule
│   ├── EmailService          — Resend SDK + Handlebars rendering
│   ├── EmailTemplateService  — CRUD for DB-stored templates
│   └── EmailController       — Admin REST endpoints (ADMIN/BROKER roles)
│
├── AuthModule (modified)
│   ├── POST /auth/signup               → sends EMAIL_VERIFICATION
│   ├── GET  /auth/verify-email?token=  → activates account
│   ├── POST /auth/forgot-password      → sends PASSWORD_RESET
│   ├── POST /auth/reset-password       → updates password
│   └── POST /auth/resend-verification  → resends verification email
│
├── AuctionService (modified)   → sends AUCTION_WON, AUCTION_STARTING
├── OrderService (modified)     → sends ORDER_STATUS_CHANGED
├── BalanceService (modified)   → sends BALANCE_TOPPED_UP, BALANCE_WITHDRAWN
└── NotificationService (modified) → sendCustomEmail wired to CUSTOM event

Admin (Angular)
└── /email-templates page
    ├── List of events with is_enabled toggle
    ├── Language tab switcher per event
    ├── Subject + body_html editor with variable hints
    └── Preview rendered HTML (iframe)

Client (Angular)
├── /verify-email?token=  — email confirmation landing page
└── /reset-password?token= — password reset form
    + login page: "Forgot password?" link + PENDING status banner
```

---

## Database

### New table: `email_settings`

| Column | Type | Notes |
|--------|------|-------|
| event_type | VARCHAR PK | Enum value (see below) |
| is_enabled | BOOLEAN | DEFAULT true |

### New table: `email_templates`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_type | VARCHAR FK | → email_settings.event_type |
| language | VARCHAR | e.g. ru, en, uk |
| subject | VARCHAR | Handlebars string |
| body_html | TEXT | Handlebars HTML |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| UNIQUE | (event_type, language) | |

### Modifications to `users` table

| Column | Type | Notes |
|--------|------|-------|
| email_verification_token | VARCHAR NULL | UUID token |
| email_verification_expires | TIMESTAMP NULL | 24h TTL |
| password_reset_token | VARCHAR NULL | UUID token |
| password_reset_expires | TIMESTAMP NULL | 1h TTL |

### Event types (enum)

```
EMAIL_VERIFICATION
PASSWORD_RESET
AUCTION_WON
AUCTION_STARTING
ORDER_STATUS_CHANGED
BALANCE_TOPPED_UP
BALANCE_WITHDRAWN
CUSTOM
```

### Template variables by event

| Event | Variables |
|-------|-----------|
| EMAIL_VERIFICATION | `{{firstName}}`, `{{verificationLink}}` |
| PASSWORD_RESET | `{{firstName}}`, `{{resetLink}}` |
| AUCTION_WON | `{{firstName}}`, `{{lotTitle}}`, `{{finalPrice}}` |
| AUCTION_STARTING | `{{firstName}}`, `{{lotTitle}}`, `{{auctionStartTime}}`, `{{lotLink}}` |
| ORDER_STATUS_CHANGED | `{{firstName}}`, `{{orderId}}`, `{{statusLabel}}` |
| BALANCE_TOPPED_UP | `{{firstName}}`, `{{amount}}`, `{{currency}}`, `{{newBalance}}` |
| BALANCE_WITHDRAWN | `{{firstName}}`, `{{amount}}`, `{{currency}}`, `{{newBalance}}` |
| CUSTOM | `{{firstName}}` |

---

## API Endpoints

### Email admin endpoints (ADMIN / BROKER roles)

```
GET    /email/settings                        → all events with is_enabled
PATCH  /email/settings/:eventType             → { is_enabled: bool }

GET    /email/templates/:eventType            → all languages for event
GET    /email/templates/:eventType/:language  → single template
PUT    /email/templates/:eventType/:language  → upsert template
POST   /email/templates/:eventType/preview    → render Handlebars → HTML
```

### Auth endpoints (new / modified)

```
POST /auth/signup                → unchanged; now also sends EMAIL_VERIFICATION
GET  /auth/verify-email?token=   → activates user (isVerified=true, status=ACTIVE)
POST /auth/forgot-password       → { email } → sends PASSWORD_RESET email
POST /auth/reset-password        → { token, newPassword }
POST /auth/resend-verification   → resend for PENDING users
```

---

## EmailService internals

```typescript
// Core send method
async send(eventType: EmailEventType, to: string, variables: Record<string, string>): Promise<void>

// Flow:
// 1. Load email_settings — if is_enabled=false, return early (no error)
// 2. Load email_template for (eventType, user.preferredLanguage), fallback to 'ru'
// 3. If no template found, log warning and return
// 4. Compile subject and body_html with Handlebars
// 5. Call Resend SDK — fire-and-forget (errors logged, not thrown)
```

All calls are fire-and-forget — email failures never block the main response.

---

## Service integration points

| Service | Trigger | Event |
|---------|---------|-------|
| `AuthService.signup` | After user created | EMAIL_VERIFICATION |
| `AuthService.verifyEmail` | Token validated | — (no email) |
| `AuthService.forgotPassword` | On request | PASSWORD_RESET |
| `AuctionService` | Winner determined | AUCTION_WON |
| `AuctionSchedulerService` | Auction starts | AUCTION_STARTING → all watchlist users |
| `OrderService` | Status changes | ORDER_STATUS_CHANGED |
| `BalanceService` | Top-up transaction | BALANCE_TOPPED_UP |
| `BalanceService` | Withdrawal transaction | BALANCE_WITHDRAWN |
| `NotificationService.sendCustomEmail` | Manager sends | CUSTOM |

---

## Admin UI

**Route:** `/email-templates`

**Layout:**
- Table of all 8 event types, each row has:
  - Human-readable event name
  - Toggle (MatSlideToggle) for is_enabled
  - "Edit" button → opens inline expansion or modal

**Editor panel per event:**
- Language tabs: RU / EN / UK / [+ Add language]
- Subject field (text input)
- Body HTML field (textarea, monospace)
- Variable hint chips below editor
- "Preview" button → POST to `/email/templates/:event/preview` → render in iframe
- "Save" button → PUT to `/email/templates/:event/:lang`

---

## Client pages

### `/verify-email`
- Reads `token` query param on init
- Calls `GET /auth/verify-email?token=`
- Success: shows confirmation message, redirects to `/cabinet` after 3s
- Error: shows error message + "Resend verification email" button

### `/reset-password`
- Reads `token` query param on init
- Shows form: new password + confirm password
- On submit: POST `/auth/reset-password`
- Success: redirect to `/auth/login` with success snackbar

### Login page modifications
- Add "Forgot password?" link → inline form with email field
- If login returns 403 with `status=PENDING`: show banner "Please confirm your email" + "Resend" link

---

## New packages

```
api:    resend, handlebars, @types/handlebars
```

No new packages required for admin or client.

---

## Error handling

- Email send failures: logged with `Logger.warn`, never thrown to caller
- Missing template for language: fallback to `ru`, then log warning if `ru` also missing
- Expired verification token: 400 with message, offer resend
- Expired reset token: 400 with message, offer new forgot-password request
- Tokens are single-use: cleared from DB after successful use

---

## Migrations

Two new migrations required:
1. Create `email_settings` and `email_templates` tables, seed default `email_settings` rows (all events, is_enabled=true)
2. Add 4 token columns to `users` table
