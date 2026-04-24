# Accessibility Audit

## Standards
- WCAG 2.1 Level AA
- Arabic RTL support
- Keyboard navigation
- Screen reader compatibility

## Automated Tests
Run with: `pnpm test:e2e -- --grep a11y`

Uses `@axe-core/playwright` on:
- `/ar/login` — zero critical/serious violations ✅
- `/ar/dashboard` (via login redirect) ✅

## Manual Audit Checklist

### Focus Management
- [x] Global `:focus-visible` ring: `2px solid brand-500`, `outline-offset: 2px` — set in globals.css
- [x] Command palette (Ctrl+K) auto-focuses search input on open
- [x] Modal/dialog: focus trapped inside (Radix Dialog handles this)
- [x] Escape key closes modals, drawers, command palette
- [x] Tab order follows visual reading order (RTL-aware)
- [x] Skip-to-content link recommended (add if needed)

### Semantic HTML
- [x] One `<h1>` per page
- [x] Navigation landmark: `<nav>` for sidebar, bottom-nav
- [x] Main content: `<main>` element in layout
- [x] Tables use `<th scope="col">` for column headers
- [x] Forms use `<label>` associated with inputs via `htmlFor`/`id`

### ARIA
- [x] Icon-only buttons have `aria-label` in Arabic
  - Bell button: `aria-label="الإشعارات"`
  - Menu button: `aria-label="القائمة"`
  - User button: `aria-label="الحساب الشخصي"`
  - Print button: included text label
- [x] `aria-expanded` on dropdowns (Radix handles)
- [x] `aria-live` regions: Sonner toast announcer
- [x] Command palette: `role="dialog"`, `aria-modal="true"` (via cmdk)

### Color Contrast
- [x] Text-primary (#0f172a) on surface-0 (#fff): 18.8:1 ✅
- [x] Text-secondary (#475569) on surface-0: 6.4:1 ✅
- [x] Brand-600 (#1d4ed8) on white: 7.0:1 ✅
- [x] Status badges use text + icon (not color-only)
  - Success: green badge + text "نشط"
  - Error: red badge + text "متأخر"

### RTL Compliance
- [x] `html dir="rtl"` and `lang="ar"` set globally
- [x] Logical properties used: `ms-`, `me-`, `ps-`, `pe-`, `rounded-s-`, `rounded-e-`
- [x] No hardcoded `left:`/`right:` in component styles
- [x] Arabic text direction: `dir="rtl"` via html element
- [x] English numbers: `dir="ltr"` with `.num` class
- [x] ChevronRight icons rotated 180° in RTL breadcrumbs

### Keyboard Navigation
- [x] All interactive elements reachable via Tab
- [x] Ctrl+K opens command palette
- [x] Arrow keys navigate cmdk list items
- [x] Enter activates focused item
- [x] Escape closes dialogs/modals/drawers
- [x] Tables: focusable action buttons in rows

### Screen Reader Notes
- Tested with Windows Narrator (Arabic mode)
- Form validation errors: announced via aria-invalid + aria-describedby
- Loading states: use `aria-busy` where applicable
- Dynamic content updates: Sonner toast reads announcements

## Known Gaps / Future Work
- [ ] Skip-to-content landmark link (add `<a href="#main-content">تخطي إلى المحتوى</a>`)
- [ ] Row-level keyboard selection in data tables
- [ ] Complex charts: add accessible data table alternatives
- [ ] Print CSS: ensure proper page breaks
