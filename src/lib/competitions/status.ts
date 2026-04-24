import type { CompetitionStatus } from "@/types";

/**
 * Derives the live status of a competition from its date window.
 * `cancelled` is sticky — only explicit action changes it.
 * `endDate` is INCLUSIVE: the competition runs through the end of that calendar day.
 * We model "end of day" as startDate.getDate() + 1 (next midnight UTC).
 */
export function computeCompetitionStatus(
  c: { startDate: Date; endDate: Date; status: CompetitionStatus },
  now: Date
): CompetitionStatus {
  if (c.status === "cancelled") return "cancelled";
  const dayAfterEnd = new Date(c.endDate);
  dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
  if (now < c.startDate) return "upcoming";
  if (now >= dayAfterEnd) return "ended";
  return "active";
}

/** Returns the exclusive upper bound of a competition (endDate + 1 day). */
export function competitionEndBound(endDate: Date): Date {
  const d = new Date(endDate);
  d.setDate(d.getDate() + 1);
  return d;
}
