# Performance Report

## Lighthouse Targets
| Metric | Target | Strategy |
|--------|--------|----------|
| Performance | ≥ 95 | Server Components, dynamic imports, no large bundles |
| Accessibility | 100 | axe-core clean, semantic HTML, ARIA |
| Best Practices | ≥ 95 | HTTPS, no deprecated APIs, secure headers |
| SEO | ≥ 90 | Metadata, canonical, robots |

## Optimizations Applied

### 1. Server Components (Default)
All pages are React Server Components by default. Only interactive leaves use `"use client"`:
- `CustomersTable`, `CommandPalette`, `NotificationBell`, `DateRangeFilter`, etc.
- Charts are wrapped in `dynamic(() => import(...), { ssr: false })` to avoid SSR hydration cost

### 2. Dynamic Imports
Heavy components loaded lazily:
- PDF renderer (`@react-pdf/renderer`): loaded only on export action, not at page load
- Recharts/Tremor chart components: `ssr: false` to prevent layout shift

### 3. Database Query Optimization
All builder functions follow patterns:
- Use `select` to fetch only needed fields
- `take: LIMIT` on all list queries (page size ≤ 20)
- Indexes defined in Prisma schema:
  - `@@index([repId])` on visits, sales_orders, collections
  - `@@index([createdAt])` on audit_logs
  - `@@index([userId])` on notifications
  - `@@index([status])` on competitions, tasks
- Raw SQL only where Prisma groupBy can't handle date truncation

### 4. Caching
- `getAccessibleUserIds` is wrapped in `cache()` from React (per-request deduplication)
- Next.js Route segment cache: dynamic pages use `export const dynamic = "force-dynamic"` only where needed
- Static pages (login, 403, 404) are fully static

### 5. Image Optimization
- No hero images used; Lucide SVG icons (inline, no img requests)
- next.config formats: `["image/avif", "image/webp"]`

### 6. Bundle Size
- Total JS budget: < 200kB (gzipped) for initial load
- Route-level code splitting by Next.js automatically
- `framer-motion` tree-shaken via named imports

### 7. Core Web Vitals Strategy
- **LCP**: Server-rendered content, no above-fold images
- **CLS**: Skeleton loaders prevent layout shifts during hydration
- **INP**: Debounced inputs (350ms), `useTransition` for non-urgent updates

## p95 Query Budgets

| Query | Expected p95 |
|-------|-------------|
| Customer list (page 1, no filter) | < 50ms |
| Customer statement (100 transactions) | < 80ms |
| Rep report (1 month) | < 200ms |
| Activity heatmap (raw SQL) | < 150ms |
| Global search (8 parallel) | < 300ms |
| Audit log (50 rows, indexed) | < 100ms |

## Before / After (estimated)

| Metric | Before Phase 9 | After Phase 9 |
|--------|---------------|--------------|
| Loading flicker | Yes (no skeletons) | No (skeleton loaders) |
| Empty state | Bare "لا يوجد" text | Illustrated EmptyState |
| Error recovery | Page crash | Error boundary + retry |
| Mobile nav | Bottom nav only | + loading states |
| Bundle (JS) | ~180kB gzipped | ~175kB (dynamic imports) |

## Commands

```bash
# Production build
pnpm build

# Start production server
pnpm start

# Lighthouse (install lighthouse CLI first: npm i -g lighthouse)
lighthouse http://localhost:3000/ar/dashboard --view

# Bundle analysis
ANALYZE=true pnpm build
```

## Recommended Next Steps
1. Add `next/font` preload for IBM Plex Arabic (already configured via `@next/font`)
2. Enable `compress: true` in next.config for gzip
3. Add `Cache-Control` headers for static assets
4. Implement Redis for session storage in production
5. Add CDN in front of Next.js for static assets
