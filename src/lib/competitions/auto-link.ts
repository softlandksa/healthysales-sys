import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * AUTO-LINK RULE (locked — do not change without updating scoring docs):
 *   When a SalesOrder is created with one or more line items whose productId
 *   matches an active competition's productId, the order is automatically linked
 *   to that competition by setting SalesOrder.competitionId.
 *
 *   "Active" means: startDate <= at <= endDate (date-range check, status != 'cancelled').
 *   Tie-break: if multiple competitions match, prefer the one whose endDate is earliest
 *   (ends soonest), giving reps maximum time to accumulate units before it expires.
 *
 *   Note: only the FIRST matching competition per order is linked. A single order
 *   cannot contribute to more than one competition.
 */
export async function findBestCompetitionFor(
  productIds: string[],
  at: Date
): Promise<string | null> {
  if (productIds.length === 0) return null;

  // Compute inclusive day boundary: at is valid if startDate <= at < endDate + 1 day
  // We approximate here by comparing raw timestamps, relying on dates being stored as midnight UTC.
  const competition = await prisma.competition.findFirst({
    where: {
      productId: { in: productIds },
      status: { not: "cancelled" },
      startDate: { lte: at },
      endDate:   { gte: at },
    },
    orderBy: { endDate: "asc" },
    select: { id: true },
  });

  return competition?.id ?? null;
}
