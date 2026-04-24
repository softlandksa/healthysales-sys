import { describe, it, expect } from "vitest";
import { computeCompetitionStatus, competitionEndBound } from "@/lib/competitions/status";
import type { CompetitionStatus } from "@/types";

function makeComp(startDate: string, endDate: string, status: CompetitionStatus = "upcoming") {
  return {
    startDate: new Date(startDate + "T00:00:00"),
    endDate:   new Date(endDate   + "T00:00:00"),
    status,
  };
}

describe("computeCompetitionStatus", () => {
  describe("cancelled is sticky", () => {
    it("cancelled stays cancelled even if now is in the active window", () => {
      const c = makeComp("2026-01-01", "2026-12-31", "cancelled");
      expect(computeCompetitionStatus(c, new Date("2026-06-15T12:00:00"))).toBe("cancelled");
    });

    it("cancelled stays cancelled after end date", () => {
      const c = makeComp("2026-01-01", "2026-03-01", "cancelled");
      expect(computeCompetitionStatus(c, new Date("2026-12-01T00:00:00"))).toBe("cancelled");
    });
  });

  describe("upcoming", () => {
    it("is upcoming when now < startDate", () => {
      const c = makeComp("2026-05-01", "2026-05-31");
      expect(computeCompetitionStatus(c, new Date("2026-04-30T23:59:59"))).toBe("upcoming");
    });

    it("becomes active exactly at startDate", () => {
      const c = makeComp("2026-05-01", "2026-05-31");
      expect(computeCompetitionStatus(c, new Date("2026-05-01T00:00:00"))).toBe("active");
    });
  });

  describe("active", () => {
    it("is active between start and end (inclusive)", () => {
      const c = makeComp("2026-05-01", "2026-05-31");
      expect(computeCompetitionStatus(c, new Date("2026-05-15T12:00:00"))).toBe("active");
    });

    it("is still active on the last day (endDate = 2026-05-31)", () => {
      const c = makeComp("2026-05-01", "2026-05-31");
      // endDate + 1 day = 2026-06-01; active until that point
      expect(computeCompetitionStatus(c, new Date("2026-05-31T23:59:59"))).toBe("active");
    });
  });

  describe("ended", () => {
    it("is ended at endDate + 1 day", () => {
      const c = makeComp("2026-05-01", "2026-05-31");
      expect(computeCompetitionStatus(c, new Date("2026-06-01T00:00:00"))).toBe("ended");
    });

    it("is ended long after endDate", () => {
      const c = makeComp("2026-05-01", "2026-05-31");
      expect(computeCompetitionStatus(c, new Date("2027-01-01T00:00:00"))).toBe("ended");
    });
  });

  describe("status field ignored for non-cancelled", () => {
    it("upcoming status field overridden by dates when now is in active window", () => {
      const c = makeComp("2026-05-01", "2026-05-31", "upcoming");
      expect(computeCompetitionStatus(c, new Date("2026-05-15T00:00:00"))).toBe("active");
    });

    it("ended status field overridden by dates when now is still in active window", () => {
      const c = makeComp("2026-05-01", "2026-05-31", "ended");
      expect(computeCompetitionStatus(c, new Date("2026-05-15T00:00:00"))).toBe("active");
    });
  });
});

describe("competitionEndBound", () => {
  it("returns the day after endDate", () => {
    const endDate = new Date("2026-05-31T00:00:00");
    const bound   = competitionEndBound(endDate);
    expect(bound.getDate()).toBe(1);
    expect(bound.getMonth()).toBe(5); // June = month 5
    expect(bound.getFullYear()).toBe(2026);
  });

  it("handles month rollover", () => {
    const endDate = new Date("2026-01-31T00:00:00");
    const bound   = competitionEndBound(endDate);
    expect(bound.getDate()).toBe(1);
    expect(bound.getMonth()).toBe(1); // February
  });

  it("handles year rollover", () => {
    const endDate = new Date("2026-12-31T00:00:00");
    const bound   = competitionEndBound(endDate);
    expect(bound.getFullYear()).toBe(2027);
    expect(bound.getMonth()).toBe(0); // January
    expect(bound.getDate()).toBe(1);
  });

  it("does not mutate the original date", () => {
    const endDate = new Date("2026-05-31T00:00:00");
    const original = endDate.getTime();
    competitionEndBound(endDate);
    expect(endDate.getTime()).toBe(original);
  });
});
