import { ShoppingCart, MapPin, Wallet, Users } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { StatCard } from "@/components/kpi/stat-card";
import { AttainmentHeatmap } from "@/components/charts/attainment-heatmap";
import { computeAchievementMetrics } from "@/lib/targets/compute";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { formatSAR, formatNumber } from "@/lib/utils";
import type { SessionUser, TargetMetric } from "@/types";

interface SalesManagerDashboardProps {
  user: SessionUser;
}

export async function SalesManagerDashboard({ user }: SalesManagerDashboardProps) {
  const now   = new Date();
  const month = currentMonthPeriod(now);
  const { periodStart, periodEnd } = month;

  // All reps in manager's subtree (direct reports + their reports)
  const allDescendantIds: string[] = [];
  let queue = [user.id];

  while (queue.length > 0) {
    const children = await prisma.user.findMany({
      where: { managerId: { in: queue } },
      select: { id: true },
    });
    queue = children.map((c) => c.id);
    allDescendantIds.push(...queue);
  }

  const repIds = allDescendantIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allDescendantIds }, role: "sales_rep", isActive: true },
        select: { id: true, name: true },
      })
    : [];

  const repIdList = repIds.map((r) => r.id);

  const [salesAgg, prevSalesAgg, collectionsAgg, visitsCount, teamCount] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: { repId: { in: repIdList }, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { total: true },
    }),
    prisma.salesOrder.aggregate({
      where: {
        repId: { in: repIdList },
        status: "collected",
        collectedAt: {
          gte: new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt:  periodStart,
        },
      },
      _sum: { total: true },
    }),
    prisma.collection.aggregate({
      where: { repId: { in: repIdList }, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
    prisma.visit.count({ where: { repId: { in: repIdList }, visitedAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.team.count({ where: { manager: { managerId: user.id } } }),
  ]);

  const sales       = Number(salesAgg._sum.total ?? 0);
  const prevSales   = Number(prevSalesAgg._sum.total ?? 0);
  const collections = Number(collectionsAgg._sum.amount ?? 0);
  const salesDelta  = prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : 0;

  // Top 10 reps by sales this month
  const top10 = await prisma.salesOrder.groupBy({
    by:    ["repId"],
    where: { repId: { in: repIdList }, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
    _sum:  { total: true },
    orderBy: { _sum: { total: "desc" } },
    take: 10,
  });

  const topRepIds = top10.map((g) => g.repId);
  const topRepNames = topRepIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: topRepIds } }, select: { id: true, name: true } })
    : [];

  const nameMap = new Map(topRepNames.map((r) => [r.id, r.name]));

  // Targets + attainments for heatmap (top 10 reps)
  const targets = await prisma.target.findMany({
    where: { userId: { in: topRepIds }, periodStart },
    select: { userId: true, metric: true, value: true, periodStart: true, periodEnd: true },
  });

  const [salesGroups, collGroups, visitGroups] = await Promise.all([
    prisma.salesOrder.groupBy({
      by:    ["repId"],
      where: { repId: { in: topRepIds }, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum:  { total: true },
    }),
    prisma.collection.groupBy({
      by:    ["repId"],
      where: { repId: { in: topRepIds }, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum:  { amount: true },
    }),
    prisma.visit.groupBy({
      by:    ["repId"],
      where: { repId: { in: topRepIds }, visitedAt: { gte: periodStart, lte: periodEnd } },
      _count: { id: true },
    }),
  ]);

  const salesMap = new Map(salesGroups.map((g) => [g.repId, Number(g._sum.total ?? 0)]));
  const collMap  = new Map(collGroups.map((g) => [g.repId, Number(g._sum.amount ?? 0)]));
  const visitMap = new Map(visitGroups.map((g) => [g.repId, g._count.id]));

  const heatmapEntries = top10.map((g) => {
    const repTargets = targets.filter((t) => t.userId === g.repId);
    const actuals: Record<TargetMetric, number> = {
      sales_amount:       salesMap.get(g.repId) ?? 0,
      collections_amount: collMap.get(g.repId)  ?? 0,
      visits_count:       visitMap.get(g.repId) ?? 0,
    };
    return {
      userId:   g.repId,
      userName: nameMap.get(g.repId) ?? null,
      achievements: repTargets.map((t) =>
        computeAchievementMetrics(
          { metric: t.metric as TargetMetric, target: Number(t.value), actual: actuals[t.metric as TargetMetric], periodStart: t.periodStart, periodEnd: t.periodEnd },
          now
        )
      ),
    };
  });

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المبيعات"
          value={formatSAR(sales)}
          delta={salesDelta}
          icon={ShoppingCart}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          label="إجمالي التحصيلات"
          value={formatSAR(collections)}
          icon={Wallet}
          iconColor="text-success-600"
          iconBg="bg-success-50"
        />
        <StatCard
          label="إجمالي الزيارات"
          value={formatNumber(visitsCount)}
          icon={MapPin}
          iconColor="text-warning-600"
          iconBg="bg-warning-50"
        />
        <StatCard
          label="عدد المندوبين"
          value={formatNumber(repIdList.length)}
          icon={Users}
          iconColor="text-chart-5"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Top 10 reps */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">أفضل 10 مندوبين — مبيعات {month.periodKey}</h3>
        <div className="divide-y divide-border">
          {top10.map((g, i) => (
            <div key={g.repId} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-text-secondary num w-5">{i + 1}</span>
                <span className="text-sm text-text-primary">{nameMap.get(g.repId) ?? g.repId}</span>
              </div>
              <span className="text-sm font-semibold text-text-primary num">{formatSAR(Number(g._sum.total ?? 0))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Attainment heatmap */}
      {heatmapEntries.some((e) => e.achievements.length > 0) && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">إنجاز الأهداف — أفضل 10 مندوبين</h3>
          <AttainmentHeatmap entries={heatmapEntries} />
        </div>
      )}

      {void teamCount}
    </div>
  );
}
