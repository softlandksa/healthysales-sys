import { ShoppingCart, MapPin, Wallet, Users } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { StatCard } from "@/components/kpi/stat-card";
import { AttainmentHeatmap } from "@/components/charts/attainment-heatmap";
import { computeAchievementMetrics } from "@/lib/targets/compute";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { formatSAR, formatNumber } from "@/lib/utils";
import type { SessionUser, TargetMetric } from "@/types";

interface TeamManagerDashboardProps {
  user: SessionUser;
}

export async function TeamManagerDashboard({ user }: TeamManagerDashboardProps) {
  const now   = new Date();
  const month = currentMonthPeriod(now);
  const { periodStart, periodEnd } = month;

  // Get team members (direct reports)
  const teamMembers = await prisma.user.findMany({
    where: { managerId: user.id, role: "sales_rep", isActive: true },
    select: { id: true, name: true },
  });
  const repIds = teamMembers.map((m) => m.id);

  const [salesAgg, prevSalesAgg, collectionsAgg, prevCollAgg, visitsCount, prevVisits] =
    await Promise.all([
      prisma.salesOrder.aggregate({
        where: { repId: { in: repIds }, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { total: true },
      }),
      prisma.salesOrder.aggregate({
        where: {
          repId: { in: repIds },
          status: "collected",
          collectedAt: {
            gte: new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000),
            lt:  periodStart,
          },
        },
        _sum: { total: true },
      }),
      prisma.collection.aggregate({
        where: { repId: { in: repIds }, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      }),
      prisma.collection.aggregate({
        where: {
          repId: { in: repIds },
          isCancelled: false,
          collectedAt: {
            gte: new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000),
            lt:  periodStart,
          },
        },
        _sum: { amount: true },
      }),
      prisma.visit.count({ where: { repId: { in: repIds }, visitedAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.visit.count({
        where: {
          repId: { in: repIds },
          visitedAt: {
            gte: new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000),
            lt:  periodStart,
          },
        },
      }),
    ]);

  const sales       = Number(salesAgg._sum.total ?? 0);
  const prevSales   = Number(prevSalesAgg._sum.total ?? 0);
  const collections = Number(collectionsAgg._sum.amount ?? 0);
  const prevColl    = Number(prevCollAgg._sum.amount ?? 0);
  const salesDelta  = prevSales  > 0 ? ((sales - prevSales) / prevSales) * 100         : 0;
  const collDelta   = prevColl   > 0 ? ((collections - prevColl) / prevColl) * 100     : 0;
  const visitsDelta = prevVisits > 0 ? ((visitsCount - prevVisits) / prevVisits) * 100 : 0;

  // Targets + attainments per rep
  const targets = await prisma.target.findMany({
    where: { userId: { in: repIds }, periodStart },
    select: { userId: true, metric: true, value: true, periodStart: true, periodEnd: true },
  });

  const [salesGroups, collGroups, visitGroups] = await Promise.all([
    prisma.salesOrder.groupBy({
      by:    ["repId"],
      where: { repId: { in: repIds }, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum:  { total: true },
    }),
    prisma.collection.groupBy({
      by:    ["repId"],
      where: { repId: { in: repIds }, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum:  { amount: true },
    }),
    prisma.visit.groupBy({
      by:    ["repId"],
      where: { repId: { in: repIds }, visitedAt: { gte: periodStart, lte: periodEnd } },
      _count: { id: true },
    }),
  ]);

  const salesMap = new Map(salesGroups.map((g) => [g.repId, Number(g._sum.total ?? 0)]));
  const collMap  = new Map(collGroups.map((g) => [g.repId, Number(g._sum.amount ?? 0)]));
  const visitMap = new Map(visitGroups.map((g) => [g.repId, g._count.id]));

  const heatmapEntries = teamMembers.map((m) => {
    const repTargets = targets.filter((t) => t.userId === m.id);
    const actuals: Record<TargetMetric, number> = {
      sales_amount:       salesMap.get(m.id) ?? 0,
      collections_amount: collMap.get(m.id)  ?? 0,
      visits_count:       visitMap.get(m.id) ?? 0,
    };
    return {
      userId:   m.id,
      userName: m.name,
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
      {/* Team KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="مبيعات الفريق"
          value={formatSAR(sales)}
          delta={salesDelta}
          icon={ShoppingCart}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          label="تحصيلات الفريق"
          value={formatSAR(collections)}
          delta={collDelta}
          icon={Wallet}
          iconColor="text-success-600"
          iconBg="bg-success-50"
        />
        <StatCard
          label="زيارات الفريق"
          value={formatNumber(visitsCount)}
          delta={visitsDelta}
          icon={MapPin}
          iconColor="text-warning-600"
          iconBg="bg-warning-50"
        />
        <StatCard
          label="عدد المندوبين"
          value={formatNumber(repIds.length)}
          icon={Users}
          iconColor="text-chart-5"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Attainment heatmap */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">إنجاز الأهداف — {month.periodKey}</h3>
        <AttainmentHeatmap entries={heatmapEntries} />
      </div>
    </div>
  );
}
