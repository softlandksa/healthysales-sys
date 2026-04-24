# Changelog

All notable changes to the Field Sales System are documented in this file.

## [Phase 9] — Final Polish, Mobile, A11Y, Performance, E2E Tests

### Added
- **Framer Motion animation system** (`src/lib/animations/variants.ts`): `fadeIn`, `pageTransition`, `staggerContainer`, `staggerItem`, `cardHoverLift`, `buttonPress`, `drawerUp` variants; all gated with `useReducedMotion()` for accessibility
- **PageTransition component**: wraps page content for smooth enter/exit animations; degrades to plain `<div>` when user prefers reduced motion
- **EmptyState component** (`src/components/empty-state.tsx`): illustrated empty states with Arabic title, description, and optional CTA link; decorative dashed ring around icon
- **Skeleton loaders** (`src/components/skeletons/index.tsx`): `ListSkeleton`, `CardGridSkeleton`, `DashboardSkeleton`, `StatementSkeleton`, `ReportSkeleton`, `FormSkeleton`
- **Loading files** (`loading.tsx`) for all 13 route segments: customers, visits, sales, collections, tasks, competitions, products, users, targets, reports, dashboard, audit-log, notifications
- **Root error boundary** (`src/app/global-error.tsx`): catches unhandled errors at app root with Arabic message and refresh button
- **Root 404 page** (`src/app/not-found.tsx`): Arabic not-found with back-to-dashboard link
- **Dashboard 404 page** (`src/app/[locale]/(dashboard)/not-found.tsx`): scoped 404 within authenticated layout
- **Playwright E2E test suite** (`tests/e2e/`):
  - `helpers.ts`: `loginAs()`, `logout()`, `waitForToast()` utilities
  - `auth.spec.ts`: login flow, redirect, session persistence, logout
  - `command-palette.spec.ts`: Ctrl+K open/close, debounced search, RBAC scoping
  - `rbac.spec.ts`: role-based route access (rep, admin, GM, viewer)
  - `a11y.spec.ts`: axe-core zero-violation check on login + dashboard
  - `customer-lifecycle.spec.ts`: create → view → statement → PDF export
  - `field-sales-flow.spec.ts`: visit log → sales order → collection → target progress
  - `reports-export.spec.ts`: date filter → Excel export → file download
  - `task-flow.spec.ts`: create task → assign → complete → notification
  - `competition-flow.spec.ts`: create competition → add target → auto-link → leaderboard
- **`playwright.config.ts`**: chromium + mobile-chrome projects; webServer auto-start; screenshots/videos on failure
- **`next.config.ts`**: `NEXT_OUTPUT=standalone` env var for Docker-optimized builds
- **Documentation** (`docs/`):
  - `MOBILE_AUDIT.md`: breakpoint-by-breakpoint audit of all pages at 360–1440px
  - `A11Y_AUDIT.md`: WCAG 2.1 AA checklist — focus management, semantic HTML, ARIA, color contrast, RTL, keyboard nav
  - `PERF_REPORT.md`: Lighthouse targets, p95 query budgets, optimization strategies

### Changed
- `package.json`: added `test:e2e`, `test:e2e:headed`, `test:e2e:ui`, `playwright:install` scripts

### Performance
- JS bundle: ~175 kB gzipped (from ~180 kB) via dynamic imports for charts and PDF
- Skeleton loaders eliminate loading flicker
- `useTransition` + debounced inputs (350ms) keep INP low

---

## [Phase 8] — System-Wide Audit Log, Notifications Center, Global Search

### Added
- **Prisma `$extends` audit extension** (`src/lib/audit/prisma-extension.ts`): automatic before/after diff capture on all write operations; skips internal models; redacts sensitive fields; fire-and-forget via `setImmediate`
- **AsyncLocalStorage audit context** (`src/lib/audit/request-context.ts`): per-request `userId`, `ip`, `userAgent`, `requestId` propagated from `withAuth`
- **`prismaBase`** (`src/lib/db/prisma-base.ts`): plain PrismaClient (no extension) used by audit writes to prevent circular recursion
- **`/ar/audit-log` page**: admin/GM only; timeline + table view; `DiffDrawer` side-panel with field-level before/after highlights; URL-persisted filters (entityType, userId, action, date range); cursor pagination (50/page)
- **Global Command Palette** (Ctrl+K) (`src/components/global-search/CommandPalette.tsx`): cmdk dialog; 150ms debounced search across 8 entity types (customers, visits, sales orders, collections, tasks, competitions, products, users); RBAC-scoped results; safe `highlightMatch()` without XSS risk
- **`/ar/notifications` page** (`NotificationsClient.tsx`): full notification list grouped by date (today/yesterday/date); type filter pills; infinite scroll; mark-all-read; bell polling every 30s + focus event listener
- **NotificationBell** animated badge via Framer Motion `AnimatePresence`
- **Middleware** updated to protect `audit-log`, `notifications`, `orders` segments

### Changed
- `src/lib/rbac/access.ts`: `withAuth` seeds `AuditContext` from request headers
- `src/lib/utils/sequences.ts`: `TX` type narrowed to structural `{ $queryRaw }` to fix Prisma extension contravariance
- `src/lib/notifications/notify.ts`: `tx?` typed as `unknown` and cast internally to avoid Prisma extension TX incompatibility
- `vitest.config.ts`: aliases converted to **array** format so specific patterns (next-auth, @/lib/auth) precede `"@"` catch-all

### Fixed
- Prisma `$extends` breaking `TX` type compatibility across sequences and notify utilities
- `exactOptionalPropertyTypes` violations in audit-log page via conditional spreads
- Vitest alias resolution order bug causing `server-only` import to fail in tests

---

## [Phase 7] — Reports Module

### Added
- **7 operational reports** under `/ar/reports/`:
  - `rep-performance`: visits, sales, collections, collections rate per rep
  - `sales-by-customer`: top customers by revenue
  - `collections-aging`: overdue balance segmented 0–30 / 31–60 / 61–90 / 90+ days
  - `product-mix`: quantity and revenue by product
  - `visit-frequency`: customer visit cadence
  - `target-vs-actual`: sales target achievement per rep
  - `activity-heatmap`: day-of-week × hour-of-day visit density (raw SQL `date_trunc`)
- **URL-persisted filters**: dateFrom, dateTo, repId propagated via Next.js `searchParams`
- **Excel/CSV export** for all tabular reports via ExcelJS; streaming response
- **RBAC scoping**: GMs see all reps; admins see their team; reps see their own data

### Changed
- Activity heatmap uses raw SQL for date truncation (Prisma groupBy limitation)

---

## [Phase 6] — Targets and Role-Aware Dashboards

### Added
- **Target model** with `period` (MONTHLY/QUARTERLY/ANNUAL), `targetAmount`, `achievedAmount`
- **UTC+3 period math**: `getPeriodBounds()` computes Saudi time period start/end, stored in UTC
- **Achievement compute**: `recalcTargetAchievement()` triggered by sales/collection writes
- **4 role dashboards** (rep, admin, GM, viewer): different KPI sets, chart combinations, and data scopes
- **KPI card components**: trend arrows, sparklines, achievement percentage rings
- **Chart components**: bar chart (monthly sales), line chart (target trend), pie chart (product mix)

### Fixed
- Period boundary calculation off-by-one for month-end dates in UTC+3

---

## [Phase 5] — Competitions and Leaderboards

### Added
- **Competition model** with `CompetitionTarget` and `CompetitionResult`
- **Auto-link**: new sales orders and collections automatically link to active competitions via trigger logic
- **Lazy status**: competition status computed from `startDate`/`endDate` (no cron needed)
- **Leaderboard raw SQL**: `RANK()` window function over `CompetitionResult.score` per competition
- **`/ar/competitions` page**: card grid with status badges, prize display, participant count
- **Competition detail page**: leaderboard table with rank, rep name, score, prize

### Changed
- Sales order and collection create actions: auto-link to active competitions after save

---

## [Phase 4] — Tasks and Notifications

### Added
- **Task model** with status machine: `PENDING → IN_PROGRESS → DONE / CANCELLED`
- **RBAC on tasks**: reps see assigned tasks; admins see team tasks; GM sees all
- **`/ar/tasks` page**: filterable table; status badge with color coding; due-date highlight when overdue
- **Task create/edit forms**: assignee picker (role-scoped), due date, priority
- **Notification system** (`notify.ts`): creates `Notification` rows; bell counter in header
- **NotificationBell** component: fetches unread count every 30s; popover with recent 5

### Changed
- Layout header: added NotificationBell between search and user menu

---

## [Phase 3] — Visits, Sales Orders, Collections

### Added
- **Visit model** with GPS coordinates, visit type, notes, photo URL
- **SalesOrder + SalesOrderItem** models: multi-line orders with product lookup, quantity, unit price
- **Collection model**: payment collection against customer balance; updates `CustomerTransaction`
- **Accounting model**: each sale creates debit transaction; each collection creates credit; balance computed from transactions
- **Mobile layout**: bottom navigation bar (4 primary items); `pb-20` main padding for bottom-nav clearance; FloatingActionButton above bottom-nav
- **`/ar/visits` page** with new-visit form (GPS picker, visit type select)
- **`/ar/sales` page** with order form (dynamic line items, customer picker, product lookup)
- **`/ar/collections` page** with collection form

### Fixed
- Bottom-nav overlapping main content on mobile (added `pb-20 md:pb-6` to `<main>`)

---

## [Phase 2] — Products and Customers

### Added
- **Product model**: name, SKU, unit price, category, active flag
- **Customer model**: code, name, region, rep assignment, credit limit
- **CustomerTransaction model**: debit/credit history; balance view
- **pg_trgm extension**: trigram similarity index for fuzzy customer search
- **Customer statement page** (`/ar/customers/[id]`): transaction history table, current balance, PDF export via `@react-pdf/renderer`
- **Export API** (`/api/customers/[id]/statement`): streaming PDF response
- **`/ar/products` page**: searchable product list; new/edit forms
- **`/ar/customers` page**: searchable customer list with balance column

### Changed
- Prisma schema: added `@@index` on all FK columns for query performance

---

## [Phase 0 / Phase 1] — Foundation

### Added
- **Next.js 15** app with App Router, TypeScript strict mode, Tailwind CSS v4
- **next-intl**: Arabic (`ar`) locale with RTL layout; English fallback
- **next-auth v5** with Prisma adapter: credential provider; JWT sessions; role field on User
- **CASL** authorization: `defineAbilitiesFor(user)` per role; `withAuth()` server action guard
- **Prisma schema**: User, Session, Account, VerificationToken base models
- **Role enum**: `ADMIN`, `GM`, `REP`, `VIEWER`
- **Sidebar navigation** with RTL-aware icons and active state
- **shadcn/ui** component library with brand color tokens
- **Vitest** unit test setup with jsdom and coverage
- **Global CSS**: `:focus-visible` ring, `.num` class for LTR numbers, scrollbar styling
- **`/ar/login` page**: credential form with `signIn()` server action
- **`/ar/dashboard` placeholder**: redirects to role-appropriate dashboard (Phase 6)
- **`/ar/users` page** (admin only): user management, role assignment, activate/deactivate
- **403 / 404 pages**: Arabic error pages with navigation links
