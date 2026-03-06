# RB Motors — Car Auction Platform

## Project Overview

Online car auction platform for European used vehicles. Three sub-apps in one monorepo:

| App | Path | Purpose |
|-----|------|---------|
| **client** | `client/` | Angular 20 SSR — public-facing buyer interface |
| **admin** | `admin/` | Angular 20 SPA — internal management dashboard |
| **api** | `api/` | NestJS — REST + WebSocket backend |

## Tech Stack

- **Frontend**: Angular 20, SCSS (BEM), Angular Material, RxJS, Socket.io-client
- **Backend**: NestJS, TypeORM, PostgreSQL, Passport JWT, Socket.io, Playwright (scraper)
- **Styling conventions**: BEM naming (`block__element--modifier`), SCSS variables from `src/styles/_variables.scss`, mixins from `src/styles/_mixins.scss`
- **Assets**: served from `client/public/` and `admin/public/` (Angular `@angular/build:application`)
- **SSR**: client app runs with `@angular/ssr`, admin is client-side only

## Key Directories

```
car-auction/
├── client/src/app/
│   ├── components/     # shared UI: header, footer, button, badge…
│   ├── pages/          # route-level components
│   ├── services/       # API calls, state, auth
│   └── models/         # TypeScript interfaces
├── admin/src/app/
│   ├── layout/         # admin shell + sidebar
│   ├── components/     # shared admin UI
│   └── pages/          # admin route pages
└── api/src/modules/    # NestJS feature modules
```

## Branding

- **Logo**: `client/public/assets/images/logo.svg` and `admin/public/assets/images/logo.svg`
- **Favicon**: `client/public/favicon.svg` and `admin/public/favicon.svg`
- **Colors**: primary accent `#0066FF`, dark bg `#0c1926`, white `#FFFFFF`

---

## Agent Workflow — ALWAYS FOLLOW THIS

At the **start of every task**, run:

```
/pm <task description>
```

The PM agent will clarify scope, flag missing context, and suggest what else to improve.

After **completing implementation**, run all three in order:

```
/reviewer
/frontend
/tester
```

Each agent inspects a specific dimension of quality. Address any issues they surface before considering the task done.

---

## Code Style Rules

- Prefer editing existing files over creating new ones
- Do not add comments unless logic is non-obvious
- Remove dead code — no `// removed` comments or unused `_vars`
- Mobile-first: always add responsive styles (`$bp-tablet`, `$bp-mobile`) when touching layout
- Never commit `.angular/cache/` or `dist/` files
- Stage only files relevant to the current task
