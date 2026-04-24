// Period helpers — all arithmetic in UTC+3 (Asia/Riyadh, no DST)

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

function toRiyadhDate(utcMs: number): Date {
  return new Date(utcMs + RIYADH_OFFSET_MS);
}

function riyadhNow(now: Date): Date {
  return toRiyadhDate(now.getTime());
}

export interface PeriodBounds {
  periodStart: Date; // UTC instant at start of period (00:00 Riyadh)
  periodEnd: Date;   // UTC instant at end of period (23:59:59.999 Riyadh)
  periodKey: string; // e.g. "2026-04" or "2026-Q2"
}

function utcFromRiyadhFields(year: number, month0: number, day: number): Date {
  // Returns UTC Date corresponding to 00:00:00 Riyadh time on the given local date
  return new Date(Date.UTC(year, month0, day) - RIYADH_OFFSET_MS);
}

function utcEndOfDayRiyadh(year: number, month0: number, day: number): Date {
  // 23:59:59.999 Riyadh = next midnight minus 1ms
  return new Date(Date.UTC(year, month0, day + 1) - RIYADH_OFFSET_MS - 1);
}

export function currentMonthPeriod(now: Date): PeriodBounds {
  const local = riyadhNow(now);
  const year  = local.getUTCFullYear();
  const month = local.getUTCMonth(); // 0-indexed

  const periodStart = utcFromRiyadhFields(year, month, 1);
  const periodEnd   = utcEndOfDayRiyadh(year, month + 1, 0); // last day of month
  const mm          = String(month + 1).padStart(2, "0");
  return { periodStart, periodEnd, periodKey: `${year}-${mm}` };
}

export function currentQuarterPeriod(now: Date): PeriodBounds {
  const local = riyadhNow(now);
  const year  = local.getUTCFullYear();
  const month = local.getUTCMonth(); // 0-indexed
  const q     = Math.floor(month / 3); // 0,1,2,3

  const startMonth = q * 3;       // 0,3,6,9
  const endMonth   = startMonth + 2; // 2,5,8,11

  const periodStart = utcFromRiyadhFields(year, startMonth, 1);
  const periodEnd   = utcEndOfDayRiyadh(year, endMonth + 1, 0);
  return { periodStart, periodEnd, periodKey: `${year}-Q${q + 1}` };
}

export function daysElapsed(periodStart: Date, now: Date): number {
  const diff = now.getTime() - periodStart.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

export function daysRemaining(periodEnd: Date, now: Date): number {
  const diff = periodEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function periodTotalDays(periodStart: Date, periodEnd: Date): number {
  // periodEnd is 23:59:59.999 of the last day, so diff is (N days - 1ms); round gives N.
  return Math.round((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
}

export function percentageOfPeriod(periodStart: Date, periodEnd: Date, now: Date): number {
  const total   = periodTotalDays(periodStart, periodEnd);
  const elapsed = daysElapsed(periodStart, now);
  if (total <= 0) return 100;
  return Math.min(100, Math.round((elapsed / total) * 100));
}
