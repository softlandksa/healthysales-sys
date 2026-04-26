import { prisma } from "@/lib/db/prisma";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
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

  const teamMembers = await prisma.user.findMany({
    where: { managerId: user.id, role: "sales_rep", isActive: true },
    select: { id: true, name: true },
  });
  const repIds = teamMembers.map((m) => m.id);

  const [salesGroups, collGroups, visitGroups, targets] = await Promise.allSettled([
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
    prisma.target.findMany({
      where: { userId: { in: repIds }, periodStart },
      select: { userId: true, metric: true, value: true, periodStart: true, periodEnd: true },
    }),
  ] as const);

  const salesMap = new Map(
    salesGroups.status === "fulfilled" ? salesGroups.value.map((g) => [g.repId, Number(g._sum.total ?? 0)]) : []
  );
  const collMap = new Map(
    collGroups.status === "fulfilled" ? collGroups.value.map((g) => [g.repId, Number(g._sum.amount ?? 0)]) : []
  );
  const visitMap = new Map(
    visitGroups.status === "fulfilled" ? visitGroups.value.map((g) => [g.repId, g._count.id]) : []
  );
  const targetsData = targets.status === "fulfilled" ? targets.value : [];

  const heatmapEntries = teamMembers.map((m) => {
    const repTargets = targetsData.filter((t) => t.userId === m.id);
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

  void formatSAR; void formatNumber;

  return (
    <div className="space-y-6">
      <DashboardSummary repIdFilter={repIds} taskAssigneeFilter={[user.id, ...repIds]} />

      {heatmapEntries.some((e) => e.achievements.length > 0) && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">إنجاز الأهداف — {month.periodKey}</h3>
          <AttainmentHeatmap entries={heatmapEntries} />
        </div>
      )}
    </div>
  );
}
