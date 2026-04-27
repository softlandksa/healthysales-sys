import { Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { ProgressCard } from "@/components/kpi/progress-card";
import { computeAchievementMetrics } from "@/lib/targets/compute";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { formatSAR, formatNumber } from "@/lib/utils";
import type { SessionUser, TargetMetric } from "@/types";

interface RepDashboardProps {
  user: SessionUser;
}

export async function RepDashboard({ user }: RepDashboardProps) {
  const now   = new Date();
  const month = currentMonthPeriod(now);
  const { periodStart, periodEnd } = month;

  const [salesAgg, collectionsAgg, visitsCount, targets, activeCompetitions] = await Promise.allSettled([
    prisma.salesOrder.aggregate({
      where: { repId: user.id, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { total: true },
    }),
    prisma.collection.aggregate({
      where: { repId: user.id, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
    prisma.visit.count({ where: { repId: user.id, visitedAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.target.findMany({
      where: { userId: user.id, periodStart },
      select: { metric: true, value: true, periodStart: true, periodEnd: true },
    }),
    prisma.competition.findMany({
      where: { status: "active", startDate: { lte: now }, endDate: { gte: now } },
      select: { id: true, name: true, endDate: true, prize: true },
      orderBy: { endDate: "asc" },
      take: 3,
    }),
  ] as const);

  const sales       = salesAgg.status       === "fulfilled" ? Number(salesAgg.value._sum.total ?? 0)       : 0;
  const collections = collectionsAgg.status === "fulfilled" ? Number(collectionsAgg.value._sum.amount ?? 0) : 0;
  const visits      = visitsCount.status    === "fulfilled" ? visitsCount.value                             : 0;
  const targetsData = targets.status        === "fulfilled" ? targets.value                                 : [];
  const competitions = activeCompetitions.status === "fulfilled" ? activeCompetitions.value                : [];

  const actuals: Record<TargetMetric, number> = {
    sales_amount:       sales,
    collections_amount: collections,
    visits_count:       visits,
  };

  const achievements = targetsData.map((t) =>
    computeAchievementMetrics(
      { metric: t.metric as TargetMetric, target: Number(t.value), actual: actuals[t.metric as TargetMetric], periodStart: t.periodStart, periodEnd: t.periodEnd },
      now
    )
  );

  return (
    <div className="space-y-6">
      <DashboardSummary repIdFilter={[user.id]} taskAssigneeFilter={[user.id]} />

      {achievements.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">إنجاز الأهداف — {month.periodKey}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {achievements.map((ach) => (
              <ProgressCard
                key={ach.metric}
                achievement={ach}
                valueFormatter={ach.metric === "visits_count" ? (n) => formatNumber(n) : (n) => formatSAR(n)}
              />
            ))}
          </div>
        </div>
      )}

      {competitions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">المنافسات الجارية</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {competitions.map((c) => {
              const daysLeft = Math.max(0, Math.ceil((c.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
              return (
                <a key={c.id} href={`/ar/competitions/${c.id}`} className="card p-4 flex gap-3 hover:border-brand-300 transition-colors">
                  <Trophy size={20} className="text-brand-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">{c.name}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      الجائزة: {c.prize} · باقي <span className="num">{daysLeft}</span> يوم
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
