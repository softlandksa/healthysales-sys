import { describe, it, expect } from "vitest";
import {
  currentMonthPeriod,
  currentQuarterPeriod,
  daysElapsed,
  daysRemaining,
  percentageOfPeriod,
  periodTotalDays,
} from "@/lib/targets/periods";

// Asia/Riyadh = UTC+3. "2026-04-15 00:00 Riyadh" = "2026-04-14T21:00:00Z"
const riyadh = (iso: string) => new Date(iso + "+03:00");

describe("currentMonthPeriod", () => {
  it("returns April 2026 for mid-April Riyadh date", () => {
    const now = riyadh("2026-04-15T12:00:00");
    const { periodStart, periodEnd, periodKey } = currentMonthPeriod(now);

    expect(periodKey).toBe("2026-04");

    // Start = 2026-04-01 00:00 Riyadh = 2026-03-31T21:00:00Z
    expect(periodStart.toISOString()).toBe("2026-03-31T21:00:00.000Z");

    // End = 2026-04-30 23:59:59.999 Riyadh = 2026-04-30T20:59:59.999Z
    expect(periodEnd.toISOString()).toBe("2026-04-30T20:59:59.999Z");
  });

  it("handles month boundary — last moment of April", () => {
    const now = riyadh("2026-04-30T23:59:59");
    const { periodKey } = currentMonthPeriod(now);
    expect(periodKey).toBe("2026-04");
  });

  it("first second of May rolls to May", () => {
    const now = riyadh("2026-05-01T00:00:00");
    const { periodKey } = currentMonthPeriod(now);
    expect(periodKey).toBe("2026-05");
  });

  it("handles December → January rollover", () => {
    const now = riyadh("2026-12-15T10:00:00");
    const { periodKey, periodStart } = currentMonthPeriod(now);
    expect(periodKey).toBe("2026-12");
    expect(periodStart.getUTCFullYear()).toBe(2026);
  });
});

describe("currentQuarterPeriod", () => {
  it("Q1: Jan–Mar", () => {
    const now = riyadh("2026-02-14T09:00:00");
    const { periodKey } = currentQuarterPeriod(now);
    expect(periodKey).toBe("2026-Q1");
  });

  it("Q2: Apr–Jun", () => {
    const now = riyadh("2026-04-23T09:00:00");
    const { periodKey, periodStart, periodEnd } = currentQuarterPeriod(now);
    expect(periodKey).toBe("2026-Q2");
    // Start = 2026-04-01 00:00 Riyadh
    expect(periodStart.toISOString()).toBe("2026-03-31T21:00:00.000Z");
    // End = 2026-06-30 23:59:59.999 Riyadh
    expect(periodEnd.toISOString()).toBe("2026-06-30T20:59:59.999Z");
  });

  it("Q3: Jul–Sep", () => {
    const now = riyadh("2026-08-01T00:00:00");
    const { periodKey } = currentQuarterPeriod(now);
    expect(periodKey).toBe("2026-Q3");
  });

  it("Q4: Oct–Dec", () => {
    const now = riyadh("2026-11-30T23:59:59");
    const { periodKey } = currentQuarterPeriod(now);
    expect(periodKey).toBe("2026-Q4");
  });
});

describe("daysElapsed / daysRemaining", () => {
  it("elapsed is 0 at period start", () => {
    const start = riyadh("2026-04-01T00:00:00");
    expect(daysElapsed(start, start)).toBe(0);
  });

  it("elapsed is 14 after 14 full days", () => {
    const start = riyadh("2026-04-01T00:00:00");
    const now   = riyadh("2026-04-15T00:00:00");
    expect(daysElapsed(start, now)).toBe(14);
  });

  it("remaining is 0 after period ends", () => {
    const end = riyadh("2026-04-30T23:59:59");
    const now = riyadh("2026-05-01T00:00:00");
    expect(daysRemaining(end, now)).toBe(0);
  });

  it("remaining rounds up — 1ms before end = 1 day remaining", () => {
    const end = riyadh("2026-04-30T23:59:59");
    const now = riyadh("2026-04-30T00:00:01");
    expect(daysRemaining(end, now)).toBeGreaterThanOrEqual(1);
  });
});

describe("periodTotalDays", () => {
  it("April has 30 days", () => {
    const { periodStart, periodEnd } = currentMonthPeriod(riyadh("2026-04-15T12:00:00"));
    expect(periodTotalDays(periodStart, periodEnd)).toBe(30);
  });

  it("Q2 has 91 days (Apr+May+Jun = 30+31+30)", () => {
    const { periodStart, periodEnd } = currentQuarterPeriod(riyadh("2026-04-15T12:00:00"));
    expect(periodTotalDays(periodStart, periodEnd)).toBe(91);
  });
});

describe("percentageOfPeriod", () => {
  it("is 0 at start", () => {
    const start = riyadh("2026-04-01T00:00:00");
    const end   = riyadh("2026-04-30T23:59:59");
    expect(percentageOfPeriod(start, end, start)).toBe(0);
  });

  it("is 100 after end", () => {
    const start = riyadh("2026-04-01T00:00:00");
    const end   = riyadh("2026-04-30T23:59:59");
    const after = riyadh("2026-05-15T00:00:00");
    expect(percentageOfPeriod(start, end, after)).toBe(100);
  });

  it("is approximately 50 at mid-month", () => {
    const start = riyadh("2026-04-01T00:00:00");
    const end   = riyadh("2026-04-30T23:59:59");
    const mid   = riyadh("2026-04-16T00:00:00"); // day 15 elapsed out of 30
    const pct   = percentageOfPeriod(start, end, mid);
    expect(pct).toBeGreaterThanOrEqual(48);
    expect(pct).toBeLessThanOrEqual(52);
  });
});
