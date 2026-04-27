import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD_LABELS } from "@/types";
import type {
  CollectionsReportFilters,
  CollectionsReportData,
  CollectionMethodRow,
  CollectionMonthPoint,
} from "../types";

export async function buildCollectionsReport(
  filters: CollectionsReportFilters,
  accessibleIds: string[]
): Promise<CollectionsReportData> {
  const { from, to, repId } = filters;

  const repFilter = repId ? repId : { in: accessibleIds };

  const baseWhere = {
    repId:       typeof repFilter === "string" ? repFilter : repFilter,
    isCancelled: false,
    collectedAt: { gte: from, lte: to },
  } as const;

  // By method
  const methodGroups = await prisma.collection.groupBy({
    by:    ["method"],
    where: baseWhere,
    _sum:  { amount: true },
    _count: { id: true },
  });

  const totalAmount = methodGroups.reduce((s, g) => s + Number(g._sum.amount ?? 0), 0);
  const byMethod: CollectionMethodRow[] = methodGroups.map((g) => {
    const amt = Number(g._sum.amount ?? 0);
    return {
      method: g.method,
      label:  PAYMENT_METHOD_LABELS[g.method as keyof typeof PAYMENT_METHOD_LABELS] ?? g.method,
      amount: amt,
      count:  g._count.id,
      pct:    totalAmount > 0 ? Math.round((amt / totalAmount) * 100) : 0,
    };
  });

  // Top collectors
  const collectorGroups = await prisma.collection.groupBy({
    by:    ["repId"],
    where: baseWhere,
    _sum:  { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  });

  const collectorIds = collectorGroups.map((g) => g.repId);
  const collectorUsers = collectorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: collectorIds } },
        select: { id: true, name: true },
      })
    : [];
  const collectorNameMap = new Map(collectorUsers.map((u) => [u.id, u.name]));

  const topCollectors = collectorGroups.map((g) => ({
    repId:   g.repId,
    repName: collectorNameMap.get(g.repId) ?? null,
    amount:  Number(g._sum.amount ?? 0),
    count:   g._count.id,
  }));

  // Monthly trend by method (raw SQL for date truncation)
  const repIds = typeof repFilter === "string" ? [repFilter] : repFilter.in;

  const monthlyRaw = await prisma.$queryRaw<
    Array<{ month: string; method: string; amount: string }>
  >(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', c.collected_at AT TIME ZONE 'Asia/Riyadh'), 'YYYY-MM') AS month,
      c.method,
      SUM(c.amount)::text AS amount
    FROM collections c
    WHERE c.rep_id = ANY(${repIds})
      AND c.is_cancelled = false
      AND c.collected_at >= ${from}
      AND c.collected_at <= ${to}
    GROUP BY month, c.method
    ORDER BY month
  `);

  const monthMap = new Map<string, CollectionMonthPoint>();
  for (const row of monthlyRaw) {
    const existing = monthMap.get(row.month) ?? { month: row.month, cash: 0, transfer: 0, check: 0 };
    const amt = parseFloat(row.amount);
    if (row.method === "cash")          existing.cash     += amt;
    else if (row.method === "bank_transfer") existing.transfer += amt;
    else if (row.method === "check")    existing.check    += amt;
    monthMap.set(row.month, existing);
  }
  const monthlyTrend = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  // Summary
  const summaryAgg = await prisma.collection.aggregate({
    where: baseWhere,
    _sum:  { amount: true },
    _count: { id: true },
    _avg:  { amount: true },
  });

  return {
    byMethod,
    topCollectors,
    monthlyTrend,
    summary: {
      total:     Number(summaryAgg._sum.amount ?? 0),
      count:     summaryAgg._count.id,
      avgAmount: Number(summaryAgg._avg.amount ?? 0),
    },
  };
}
