import { prisma } from "@/lib/prisma";
import type { TargetMetric, SalesOrderStatus } from "@prisma/client";
import type { TargetsReportFilters, TargetsReportData } from "../types";

const ACTIVE_ORDER_STATUSES: SalesOrderStatus[] = ["confirmed", "delivered", "collected"];

export async function buildTargetsReport(
  filters: TargetsReportFilters,
  accessibleIds: string[]
): Promise<TargetsReportData> {
  const userFilter = filters.userId ? [filters.userId] : accessibleIds;

  const targets = await prisma.target.findMany({
    where: {
      userId:      { in: userFilter },
      periodStart: { lte: filters.to },
      periodEnd:   { gte: filters.from },
      ...(filters.metric ? { metric: filters.metric as TargetMetric } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ periodStart: "desc" }, { metric: "asc" }],
  }).catch(() => []);

  // Group targets by unique period range to batch-fetch actuals
  const periodRangeMap = new Map<string, { start: Date; end: Date; userIds: Set<string> }>();
  for (const t of targets) {
    const key = `${t.periodStart.toISOString()}|${t.periodEnd.toISOString()}`;
    const existing = periodRangeMap.get(key) ?? { start: t.periodStart, end: t.periodEnd, userIds: new Set() };
    existing.userIds.add(t.userId);
    periodRangeMap.set(key, existing);
  }

  // Fetch actuals per period range (cap at 12 unique ranges for safety)
  const actualsMap = new Map<string, { sales: number; collections: number; visits: number }>();

  for (const [rangeKey, range] of [...periodRangeMap.entries()].slice(0, 12)) {
    const userIds = [...range.userIds];

    const [salesG, collG, visitG] = await Promise.allSettled([
      prisma.salesOrder.groupBy({
        by: ["repId"],
        where: { repId: { in: userIds }, status: { in: ACTIVE_ORDER_STATUSES }, createdAt: { gte: range.start, lte: range.end } },
        _sum: { total: true },
      }),
      prisma.collection.groupBy({
        by: ["repId"],
        where: { repId: { in: userIds }, isCancelled: false, collectedAt: { gte: range.start, lte: range.end } },
        _sum: { amount: true },
      }),
      prisma.visit.groupBy({
        by: ["repId"],
        where: { repId: { in: userIds }, visitedAt: { gte: range.start, lte: range.end } },
        _count: { id: true },
      }),
    ] as const);

    const salesByUser = salesG.status === "fulfilled" ? salesG.value : [];
    const collByUser  = collG.status  === "fulfilled" ? collG.value  : [];
    const visitByUser = visitG.status === "fulfilled" ? visitG.value : [];

    const sSales  = new Map(salesByUser.map((g) => [g.repId, Number(g._sum.total  ?? 0)]));
    const sColl   = new Map(collByUser.map((g)  => [g.repId, Number(g._sum.amount ?? 0)]));
    const sVisit  = new Map(visitByUser.map((g) => [g.repId, g._count.id]));

    for (const userId of userIds) {
      actualsMap.set(`${rangeKey}|${userId}`, {
        sales:       sSales.get(userId)  ?? 0,
        collections: sColl.get(userId)   ?? 0,
        visits:      sVisit.get(userId)  ?? 0,
      });
    }
  }

  // Enrich targets with actuals
  const enriched = targets.map((t) => {
    const rangeKey = `${t.periodStart.toISOString()}|${t.periodEnd.toISOString()}`;
    const actuals  = actualsMap.get(`${rangeKey}|${t.userId}`);

    let actual: number | null = null;
    if (actuals) {
      if (t.metric === "sales_amount")       actual = actuals.sales;
      if (t.metric === "collections_amount") actual = actuals.collections;
      if (t.metric === "visits_count")       actual = actuals.visits;
    }

    const pct = actual !== null ? (actual / Math.max(1, Number(t.value))) * 100 : null;

    return {
      id:          t.id,
      userId:      t.userId,
      userName:    t.user.name ?? t.user.email,
      metric:      t.metric,
      period:      t.period,
      periodStart: t.periodStart,
      periodEnd:   t.periodEnd,
      targetValue: Number(t.value),
      actual,
      pct,
    };
  });

  const withPct        = enriched.filter((t) => t.pct !== null);
  const avgAchievement = withPct.length > 0
    ? withPct.reduce((s, t) => s + Math.min(200, t.pct!), 0) / withPct.length
    : 0;

  // Aggregate by metric
  type MetricAgg = { count: number; pctSum: number; pctCount: number };
  const metricMap = new Map<string, MetricAgg>();
  for (const t of enriched) {
    const cur = metricMap.get(t.metric) ?? { count: 0, pctSum: 0, pctCount: 0 };
    cur.count++;
    if (t.pct !== null) { cur.pctSum += t.pct; cur.pctCount++; }
    metricMap.set(t.metric, cur);
  }

  return {
    summary: {
      totalTargets:   enriched.length,
      uniqueUsers:    new Set(enriched.map((t) => t.userId)).size,
      avgAchievement,
      fullyAchieved:  withPct.filter((t) => t.pct! >= 100).length,
      atRisk:         withPct.filter((t) => t.pct! < 70).length,
    },
    targets: enriched,
    byMetric: [...metricMap.entries()].map(([metric, agg]) => ({
      metric,
      count:          agg.count,
      avgAchievement: agg.pctCount > 0 ? agg.pctSum / agg.pctCount : 0,
    })),
  };
}
