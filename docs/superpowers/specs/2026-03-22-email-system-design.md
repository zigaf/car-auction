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
│   ├── POST /auth/signup               → sends EMAIL_VERIFICATION (email/password users only)
│   ├── POST /auth/verify-email         → activates account (client POSTs token)
│   ├── POST /auth/forgot-password      → sends PASSWORD_RESET
│   ├── POST /auth/reset-password       → updates password
│   └── POST /auth/resend-verification  → { email } → resends verification email
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
    ├── Preview rendered HTML (iframe)
    └── Delete template per language

Client (Angular)
├── /verify-email?token=  — lands here from email link, POSTs token to API
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
| language | VARCHAR | Must match `Language` enum values: ru, en, uk |
| subject | VARCHAR | Handlebars string |
| body_html | TEXT | Handlebars HTML |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| UNIQUE | (event_type, language) | |

**Note:** `email_templates.language` values must exactly match the `Language` enum used in `user.entity.ts` (`ru`, `en`, `uk`). This avoids mismatch at query time when looking up a template by `user.preferredLanguage`.

### Modifications to `users` table

| Column | Type | Notes |
|--------|------|-------|
| email_verification_token | VARCHAR NULL | 64-char hex token |
| email_verification_expires | TIMESTAMP NULL | 24h TTL |
| password_reset_token | VARCHAR NULL | 64-char hex token |
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
| CUSTOM | `{{firstName}}`, `{{subject}}`, `{{message}}` |

---

## API Endpoints

### Email admin endpoints (ADMIN / BROKER roles)

```
GET    /email/settings                        → all events with is_enabled
PATCH  /email/settings/:eventType             → { is_enabled: bool }

GET    /email/templates/:eventType            → all languages for event
GET    /email/templates/:eventType/:language  → single template
PUT    /email/templates/:eventType/:language  → upsert template { subject, body_html }
DELETE /email/templates/:eventType/:language  → delete template for a language
POST   /email/templates/:eventType/preview    → render Handlebars → HTML (returns HTML string)
```

### Auth endpoints (new / modified)

```
POST /auth/signup                → unchanged; sends EMAIL_VERIFICATION for email/password users
POST /auth/verify-email          → { token } → activates user (isVerified=true, status=ACTIVE)
POST /auth/forgot-password       → { email } → sends PASSWORD_RESET (errors silently for unknown emails)
POST /auth/reset-password        → { token, newPassword }
POST /auth/resend-verification   → { email } → unauthenticated; resend for PENDING users
```

**`POST /auth/login` change:** If user `status=PENDING` (email not verified), return `403 Forbidden` with body `{ message: "Email not verified", code: "EMAIL_NOT_VERIFIED" }`. The client uses `code` to show the resend banner. This does not affect OAuth users (they are auto-verified).

**`POST /auth/forgot-password` for OAuth-only users:** If the user was created via OAuth and has no `passwordHash`, return `400 Bad Request` with `{ message: "This account uses social login. Password reset is not available." }`.

---

## OAuth users — verification rules

Users registered via Google, Yandex, VK, or Telegram are considered pre-verified by the OAuth provider:
- On first OAuth login/registration: `isVerified = true`, `status = ACTIVE`
- They do **not** receive `EMAIL_VERIFICATION` emails
- The `PENDING` login banner does not apply to them
- `POST /auth/resend-verification` returns `400` if the account is OAuth-only

---

## EmailService internals

### Token generation

Tokens are generated using `crypto.randomBytes(32).toString('hex')` — 256 bits of entropy. Never use UUID v1/v3/v5 for security tokens.

```typescript
import { randomBytes } from 'crypto';
const token = randomBytes(32).toString('hex'); // 64-char hex string
```

Tokens are single-use: cleared from `users` table immediately after successful verification or password reset.

### Core send method

```typescript
async send(eventType: EmailEventType, to: string, variables: Record<string, string>): Promise<void>

// Flow:
// 1. Load email_settings — if is_enabled=false, return early (no error)
// 2. Load email_template for (eventType, user.preferredLanguage), fallback to 'ru'
// 3. If no template found for 'ru' either, log Logger.warn and return (no throw)
// 4. Compile subject and body_html with Handlebars using variables
// 5. Call Resend SDK — fire-and-forget (errors logged, not thrown)
```

**CUSTOM event:** `sendCustomEmail(userId, subject, message)` passes `{ subject, message, firstName }` as Handlebars variables into the stored CUSTOM template. The template body_html can freely reference `{{message}}` to place the manager's message text.

All calls are fire-and-forget — email failures never block the main response.

---

## Service integration points

| Service | Trigger | Event |
|---------|---------|-------|
| `AuthService.signup` | After email/password user created | EMAIL_VERIFICATION |
| `AuthService.forgotPassword` | On request (email/password users only) | PASSWORD_RESET |
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
- Variable hint chips below editor (shows available `{{variables}}` for the event)
- "Preview" button → POST to `/email/templates/:event/preview` → render in iframe
- "Save" button → PUT to `/email/templates/:event/:lang`
- "Delete" button (shown only when template exists) → DELETE `/email/templates/:event/:lang` with confirmation dialog

**Note on missing templates:** Events with no template for a given language will silently not send emails. The admin UI should indicate missing templates visually (e.g. a warning icon on language tabs with no template saved).

---

## Client pages

### `/verify-email`
- Reads `token` query param on page init
- POSTs `{ token }` to `POST /auth/verify-email` (not GET, to avoid email scanner prefetch activating accounts)
- Success: shows confirmation message, redirects to `/cabinet` after 3s
- Error (invalid/expired token): shows error message + "Resend verification email" button (calls `POST /auth/resend-verification` with the email from a form field if needed)

### `/reset-password`
- Reads `token` query param on init
- Shows form: new password + confirm password
- On submit: POST `/auth/reset-password { token, newPassword }`
- Success: redirect to `/auth/login` with success snackbar
- Error (expired/invalid): show message + link to forgot-password form

### Login page modifications
- Add "Forgot password?" link → inline form with email field → calls `POST /auth/forgot-password`
- If login returns `403` with `code: "EMAIL_NOT_VERIFIED"`: show banner "Please confirm your email" + "Resend" button → calls `POST /auth/resend-verification { email }`

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
- OAuth user requests password reset: 400 with descriptive message
- OAuth user requests resend-verification: 400 (already verified)

---

## Migrations

Three migrations required:

**Migration 1:** Create `email_settings` and `email_templates` tables. Seed `email_settings` rows for all 8 event types with `is_enabled=true`. No template rows are seeded — an admin must create templates via the UI before emails will send. Events with no template silently skip sending (logged as warning).

**Migration 2:** Add 4 token columns to `users` table (`email_verification_token`, `email_verification_expires`, `password_reset_token`, `password_reset_expires`).

**Migration 3:** (If needed) Any index on `email_templates(event_type, language)` beyond the UNIQUE constraint, or `users(email_verification_token)` for fast lookup.
