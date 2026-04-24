# Production Deployment Checklist

## 1. Environment Variables

Set the following in your production environment (Vercel / Docker / VPS):

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/sales_sys?schema=public&sslmode=require"

# Auth
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://your-domain.com"

# App
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Optional: standalone Docker build
NEXT_OUTPUT="standalone"
```

- [ ] All secrets are 32+ characters and randomly generated
- [ ] `DATABASE_URL` points to production DB (not dev/staging)
- [ ] `NEXTAUTH_URL` matches the exact production domain (no trailing slash)
- [ ] No `.env.local` or dev secrets are committed to the repository

---

## 2. Database

### Migrations
```bash
# Apply all pending migrations to production DB
pnpm prisma migrate deploy

# Verify migrations applied cleanly
pnpm prisma migrate status
```

- [ ] `prisma migrate deploy` ran without errors
- [ ] All migrations in `prisma/migrations/` are applied
- [ ] No `prisma db push` used in production (use migrations only)

### Indexes
Confirm the following indexes exist (defined in schema, created by migrate):
- [ ] `visits.repId`, `visits.createdAt`
- [ ] `sales_orders.repId`, `sales_orders.createdAt`
- [ ] `collections.repId`
- [ ] `audit_logs.createdAt`
- [ ] `notifications.userId`
- [ ] `competitions.status`
- [ ] `tasks.status`
- [ ] `customer_transactions.customerId`

### Extensions
```sql
-- Verify pg_trgm is enabled (required for fuzzy customer search)
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```
- [ ] `pg_trgm` extension is enabled in production DB

---

## 3. Build

```bash
# Full production build
pnpm build

# Start production server (local smoke test)
pnpm start
```

- [ ] `pnpm build` exits with code 0
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No ESLint errors (`pnpm lint`)
- [ ] Bundle analyzer checked: `ANALYZE=true pnpm build` (JS ≤ 200 kB gzipped)

---

## 4. Docker (if containerized)

```bash
# Build standalone image
NEXT_OUTPUT=standalone pnpm build

# Build Docker image
docker build -t sales-sys:latest .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e NEXTAUTH_SECRET="..." \
  -e NEXTAUTH_URL="https://your-domain.com" \
  sales-sys:latest
```

- [ ] Docker image builds successfully
- [ ] Container starts and `/ar/login` responds with HTTP 200
- [ ] Health check endpoint returns 200

---

## 5. Security Headers

Add to `next.config.ts` or reverse proxy (nginx/Cloudflare):

```typescript
headers: async () => [
  {
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval in dev
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "connect-src 'self'",
        ].join("; "),
      },
    ],
  },
],
```

- [ ] `X-Frame-Options: DENY` set
- [ ] `X-Content-Type-Options: nosniff` set
- [ ] HTTPS enforced (redirect HTTP → HTTPS at CDN/load balancer)
- [ ] HSTS header configured at reverse proxy level
- [ ] CSP header reviewed and tightened for production (remove `unsafe-eval` if possible)

---

## 6. Seed Admin User

```bash
# Create first admin user (run once on fresh DB)
pnpm db:seed
```

Or run directly:
```sql
-- Change these values before running
INSERT INTO "User" (id, name, email, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'System Admin',
  'admin@company.com',
  '<bcrypt hash of password>',  -- use bcryptjs.hashSync('password', 10)
  'ADMIN',
  true,
  now(),
  now()
);
```

- [ ] At least one ADMIN user exists
- [ ] At least one GM user exists
- [ ] Default passwords changed immediately after first login

---

## 7. Smoke Tests

After deployment, verify:

```bash
# Install Playwright browsers (once)
pnpm playwright:install

# Run E2E tests against production
BASE_URL=https://your-domain.com pnpm test:e2e
```

Manual smoke test checklist:
- [ ] `/ar/login` — loads, can log in as admin
- [ ] `/ar/dashboard` — loads with KPI cards
- [ ] `/ar/customers` — lists customers, search works
- [ ] `/ar/visits/new` — form submits successfully
- [ ] `/ar/sales/new` — order creates, balance updates
- [ ] `/ar/reports/rep-performance` — loads with current month data
- [ ] `/ar/audit-log` — shows recent mutations (visible to admin)
- [ ] Ctrl+K — command palette opens and returns results
- [ ] Notification bell — shows unread count, polling active
- [ ] PDF export on customer statement — downloads without error
- [ ] Excel export on any report — downloads `.xlsx`

---

## 8. Performance

```bash
# Run Lighthouse against production
npx lighthouse https://your-domain.com/ar/dashboard \
  --chrome-flags="--headless" \
  --output=json \
  --output-path=lighthouse-report.json
```

Targets:
- [ ] Performance ≥ 95
- [ ] Accessibility = 100
- [ ] Best Practices ≥ 95
- [ ] SEO ≥ 90

---

## 9. Monitoring

- [ ] Error monitoring configured (Sentry or equivalent)
- [ ] Uptime monitoring configured (ping `/ar/login` every 1 min)
- [ ] Database connection pool sized correctly (default: 10; adjust via `connection_limit` in DATABASE_URL)
- [ ] Log aggregation set up (stdout/stderr from Next.js process)
- [ ] Alerts configured for p99 > 2s response time

---

## 10. Backup

- [ ] Automated daily DB backups configured
- [ ] Backup restoration tested
- [ ] Backup retention: minimum 30 days
- [ ] Point-in-time recovery enabled (if using managed Postgres)

---

## 11. Post-Deployment

- [ ] DNS TTL restored to normal value (if lowered for cutover)
- [ ] Old environment decommissioned (after confirming production is stable)
- [ ] Team notified of deployment
- [ ] CHANGELOG updated with release date

---

## Recommended Future Improvements

1. **Redis session storage**: replace JWT sessions with Redis for instant revocation
2. **CDN**: put Cloudflare or AWS CloudFront in front of Next.js
3. **`next/font` preload**: IBM Plex Arabic is already configured; verify preload link in `<head>`
4. **`compress: true`** in `next.config.ts`: enable gzip at Next.js layer (if not handled by reverse proxy)
5. **Cache-Control headers**: add `s-maxage` for static assets via `next.config.ts` headers
6. **Rate limiting**: add rate limit middleware on `/api/` routes and `/ar/login`
7. **Webhook alerts**: send Slack/Teams notification on deployment completion
