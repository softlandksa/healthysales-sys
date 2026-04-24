# Mobile Responsive Audit

## Breakpoints Tested
- 360px (small Android)
- 414px (iPhone Pro)
- 768px (tablet / iPad portrait)
- 1024px (tablet landscape / small laptop)
- 1440px (desktop)

## Responsive Strategy per Component

### Tables
All tables use `overflow-x-auto` container. On mobile (< 640px):
- Customers table: horizontal scroll with sticky code column
- Sales orders: horizontal scroll, status badge visible first
- Collections: horizontal scroll
- Tasks: horizontal scroll

### Filter Bars
- Desktop (≥ 768px): inline flex row
- Mobile (< 768px): stacked vertically inside card

### Forms
- All forms: single-column stacked on mobile (`max-w-2xl`, full width on mobile)
- Two-column grids on desktop: `grid-cols-1 sm:grid-cols-2`

### Modals
- ≥ 640px: centered dialog
- < 640px: bottom sheet (drawerUp animation variant)

### Navigation
- Desktop: left sidebar (240px collapsed → 64px icon-only)
- Mobile: hamburger in header → Sheet sliding from right (RTL)
- Mobile bottom nav: 4 primary items, safe-area-aware padding

## Page-by-Page Audit

| Page | 360px | 414px | 768px | 1024px | 1440px | Notes |
|------|-------|-------|-------|--------|--------|-------|
| /ar/login | ✅ | ✅ | ✅ | ✅ | ✅ | Single card, centered |
| /ar/dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | KPI grid 2×2 on mobile, 4×1 on desktop |
| /ar/customers | ✅ | ✅ | ✅ | ✅ | ✅ | Table scrolls, search full-width |
| /ar/customers/new | ✅ | ✅ | ✅ | ✅ | ✅ | Single-column form |
| /ar/customers/[id] | ✅ | ✅ | ✅ | ✅ | ✅ | Statement table scrollable |
| /ar/visits | ✅ | ✅ | ✅ | ✅ | ✅ | Table scrolls |
| /ar/visits/new | ✅ | ✅ | ✅ | ✅ | ✅ | Form single-column |
| /ar/sales | ✅ | ✅ | ✅ | ✅ | ✅ | Table scrolls |
| /ar/sales/new | ✅ | ✅ | ✅ | ✅ | ✅ | Items grid collapses |
| /ar/collections | ✅ | ✅ | ✅ | ✅ | ✅ | |
| /ar/tasks | ✅ | ✅ | ✅ | ✅ | ✅ | |
| /ar/competitions | ✅ | ✅ | ✅ | ✅ | ✅ | Card grid 1-col on mobile |
| /ar/targets | ✅ | ✅ | ✅ | ✅ | ✅ | |
| /ar/reports/* | ✅ | ✅ | ✅ | ✅ | ✅ | Date filter stacks on mobile |
| /ar/notifications | ✅ | ✅ | ✅ | ✅ | ✅ | |
| /ar/audit-log | ✅ | ✅ | ✅ | ✅ | ✅ | Table scrolls, diff drawer full-screen mobile |

## Touch Target Compliance
- All shadcn `<Button size="sm">`: 36px min (compliant with 44px for icon-only via padding)
- Icon-only buttons use `size="icon"` (40×40px) ✅
- Bottom nav items: 60px wide, 44px+ tap area ✅
- Form inputs: 40px height (h-10) ✅

## Fixed Issues
1. `main` has `pb-20 md:pb-6` to prevent bottom-nav overlap ✅ (set in layout.tsx)
2. All tables wrapped in `overflow-x-auto` containers ✅
3. Sidebar hidden on mobile; MobileNav Sheet used ✅
4. FloatingActionButton positioned above bottom-nav (`bottom-20 md:bottom-6`) ✅
5. Command palette: full-width on mobile with `mx-4` margin ✅
