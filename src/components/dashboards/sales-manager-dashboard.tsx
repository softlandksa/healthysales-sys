import { prisma } from "@/lib/db/prisma";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
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

  const repRecords = allDescendantIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allDescendantIds }, role: "sales_rep", isActive: true },
        select: { id: true, name: true },
      })
    : [];
  const repIdList = repRecords.map((r) => r.id);

  const [top10R, targetsR, salesGroupsR, collGroupsR, visitGroupsR] = await Promise.allSettled([
    prisma.salesOrder.groupBy({
      by:    ["repId"],
      where: { repId: { in: repIdList }, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum:  { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),
    prisma.target.findMany({
      where: { userId: { in: repIdList }, periodStart },
      select: { userId: true, metric: true, value: true, periodStart: true, periodEnd: true },
    }),
    prisma.salesOrder.groupBy({
      by:    ["repId"],
      where: { repId: { in: repIdList }, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum:  { total: true },
    }),
    prisma.collection.groupBy({
      by:    ["repId"],
      where: { repId: { in: repIdList }, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum:  { amount: true },
    }),
    prisma.visit.groupBy({
      by:    ["repId"],
      where: { repId: { in: repIdList }, visitedAt: { gte: periodStart, lte: periodEnd } },
      _count: { id: true },
    }),
  ] as const);

  const top10       = top10R.status       === "fulfilled" ? top10R.value       : [];
  const targetsData = targetsR.status     === "fulfilled" ? targetsR.value     : [];
  const salesGroups = salesGroupsR.status === "fulfilled" ? salesGroupsR.value : [];
  const collGroups  = collGroupsR.status  === "fulfilled" ? collGroupsR.value  : [];
  const visitGroups = visitGroupsR.status === "fulfilled" ? visitGroupsR.value : [];

  const topRepIds  = top10.map((g) => g.repId);
  const topRepNames = topRepIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: topRepIds } }, select: { id: true, name: true } })
    : [];
  const nameMap  = new Map(topRepNames.map((r) => [r.id, r.name]));
  const salesMap = new Map(salesGroups.map((g) => [g.repId, Number(g._sum.total ?? 0)]));
  const collMap  = new Map(collGroups.map((g) => [g.repId, Number(g._sum.amount ?? 0)]));
  const visitMap = new Map(visitGroups.map((g) => [g.repId, g._count.id]));

  const heatmapEntries = top10.map((g) => {
    const repTargets = targetsData.filter((t) => t.userId === g.repId);
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
      <DashboardSummary repIdFilter={repIdList} taskAssigneeFilter={[user.id, ...allDescendantIds]} />

      {top10.length > 0 && (
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
      )}

      {heatmapEntries.some((e) => e.achievements.length > 0) && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">إنجاز الأهداف — أفضل 10 مندوبين</h3>
          <AttainmentHeatmap entries={heatmapEntries} />
        </div>
      )}

      {void formatNumber}
    </div>
  );
}
