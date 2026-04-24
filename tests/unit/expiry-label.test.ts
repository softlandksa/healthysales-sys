import { describe, it, expect, beforeEach, vi } from "vitest";
import { daysToExpiry, expiryStatus, statusLabel } from "@/lib/utils/expiry";

// Pin "today" to 2026-04-23 to make tests deterministic
const TODAY = new Date(2026, 3, 23); // months are 0-indexed

function daysFromNow(days: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

describe("daysToExpiry", () => {
  it("returns 0 for today", () => {
    expect(daysToExpiry(daysFromNow(0))).toBe(0);
  });

  it("returns 1 for tomorrow", () => {
    expect(daysToExpiry(daysFromNow(1))).toBe(1);
  });

  it("returns -1 for yesterday", () => {
    expect(daysToExpiry(daysFromNow(-1))).toBe(-1);
  });

  it("returns 180 for 180 days out", () => {
    expect(daysToExpiry(daysFromNow(180))).toBe(180);
  });

  it("returns 181 for 181 days out", () => {
    expect(daysToExpiry(daysFromNow(181))).toBe(181);
  });
});

describe("expiryStatus boundaries", () => {
  it("expired — negative days", () => {
    expect(expiryStatus(daysFromNow(-1))).toBe("expired");
    expect(expiryStatus(daysFromNow(-30))).toBe("expired");
  });

  it("danger — 0 days (today)", () => {
    expect(expiryStatus(daysFromNow(0))).toBe("danger");
  });

  it("critical — 1 day", () => {
    expect(expiryStatus(daysFromNow(1))).toBe("critical");
  });

  it("critical — 6 days", () => {
    expect(expiryStatus(daysFromNow(6))).toBe("critical");
  });

  it("near — 7 days", () => {
    expect(expiryStatus(daysFromNow(7))).toBe("near");
  });

  it("near — 29 days", () => {
    expect(expiryStatus(daysFromNow(29))).toBe("near");
  });

  it("watch — 30 days", () => {
    expect(expiryStatus(daysFromNow(30))).toBe("watch");
  });

  it("watch — 89 days", () => {
    expect(expiryStatus(daysFromNow(89))).toBe("watch");
  });

  it("fresh — 90 days", () => {
    expect(expiryStatus(daysFromNow(90))).toBe("fresh");
  });

  it("fresh — 180 days", () => {
    expect(expiryStatus(daysFromNow(180))).toBe("fresh");
  });

  it("fresh — 181 days", () => {
    expect(expiryStatus(daysFromNow(181))).toBe("fresh");
  });
});

describe("statusLabel", () => {
  it("shows expired message for past dates", () => {
    expect(statusLabel(daysFromNow(-5))).toContain("منتهي");
  });

  it("shows 'ينتهي اليوم' for today", () => {
    expect(statusLabel(daysFromNow(0))).toBe("ينتهي اليوم");
  });

  it("shows 'ينتهي غداً' for tomorrow", () => {
    expect(statusLabel(daysFromNow(1))).toBe("ينتهي غداً");
  });

  it("shows remaining days for future dates", () => {
    const label = statusLabel(daysFromNow(30));
    expect(label).toContain("30");
    expect(label).toContain("أيام");
  });
});
