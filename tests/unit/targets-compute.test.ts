import { describe, it, expect } from "vitest";
import { computeAchievementMetrics } from "@/lib/targets/compute";

const riyadh = (iso: string) => new Date(iso + "+03:00");

const aprilStart = riyadh("2026-04-01T00:00:00");
const aprilEnd   = riyadh("2026-04-30T23:59:59");

function makeInput(target: number, actual: number) {
  return {
    metric:      "sales_amount" as const,
    target,
    actual,
    periodStart: aprilStart,
    periodEnd:   aprilEnd,
  };
}

describe("computeAchievementMetrics — attainment", () => {
  it("100% attainment when actual equals target", () => {
    const now = riyadh("2026-04-30T12:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 100_000), now);
    expect(r.attainment).toBeCloseTo(100);
  });

  it("0% attainment with zero actual", () => {
    const now = riyadh("2026-04-15T12:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 0), now);
    expect(r.attainment).toBe(0);
  });

  it("attainment can exceed 100% when actual > target", () => {
    const now = riyadh("2026-04-30T12:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 150_000), now);
    expect(r.attainment).toBeCloseTo(150);
  });
});

describe("computeAchievementMetrics — status", () => {
  it("'ahead' when projected attainment >= 110%", () => {
    // At day 15 with 70% actual → projected ~140%
    const now = riyadh("2026-04-16T00:00:00"); // ~15 days elapsed
    const r   = computeAchievementMetrics(makeInput(100_000, 70_000), now);
    expect(r.status).toBe("ahead");
    expect(r.projectedAttainment).toBeGreaterThanOrEqual(110);
  });

  it("'at_risk' when projected attainment < 90% and days remain", () => {
    // At day 15 with 20% actual → projected ~40%
    const now = riyadh("2026-04-16T00:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 20_000), now);
    expect(r.status).toBe("at_risk");
  });

  it("'behind' when period ended and projected < 90%", () => {
    // After period end
    const now = riyadh("2026-05-05T00:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 50_000), now);
    expect(r.status).toBe("behind");
  });

  it("'on_track' when pace is normal (no dramatic over/under)", () => {
    // At day 15 with 50% actual → projected ~100%
    const now = riyadh("2026-04-16T00:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 50_000), now);
    expect(r.status).toBe("on_track");
  });
});

describe("computeAchievementMetrics — projection", () => {
  it("projects linearly from elapsed days", () => {
    // 15 days elapsed, 15 remaining, actual = 50_000 → projected = 100_000
    const now = riyadh("2026-04-16T00:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 50_000), now);
    expect(r.projected).toBeCloseTo(100_000, -2);
  });

  it("projected equals actual when elapsed = 0 (period just started)", () => {
    const now = riyadh("2026-04-01T00:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 0), now);
    expect(r.projected).toBe(0);
  });
});

describe("computeAchievementMetrics — days", () => {
  it("daysElapsed increases with time", () => {
    const now1 = riyadh("2026-04-05T00:00:00");
    const now2 = riyadh("2026-04-20T00:00:00");
    const r1   = computeAchievementMetrics(makeInput(100_000, 20_000), now1);
    const r2   = computeAchievementMetrics(makeInput(100_000, 60_000), now2);
    expect(r2.daysElapsed).toBeGreaterThan(r1.daysElapsed);
  });

  it("daysRemaining is 0 after period end", () => {
    const now = riyadh("2026-05-01T12:00:00");
    const r   = computeAchievementMetrics(makeInput(100_000, 80_000), now);
    expect(r.daysRemaining).toBe(0);
  });
});

describe("computeAchievementMetrics — zero target guard", () => {
  it("returns 0 attainment when target is 0", () => {
    const now = riyadh("2026-04-15T12:00:00");
    const r   = computeAchievementMetrics(makeInput(0, 50_000), now);
    expect(r.attainment).toBe(0);
    expect(r.projectedAttainment).toBe(0);
  });
});
