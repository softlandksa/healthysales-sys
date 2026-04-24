import { ShoppingCart, MapPin, Wallet, ClipboardList, Trophy } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { StatCard } from "@/components/kpi/stat-card";
import { ProgressCard } from "@/components/kpi/progress-card";
import { computeAchievementMetrics } from "@/lib/targets/compute";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { formatSAR, formatNumber } from "@/lib/utils";
import type { SessionUser, TargetMetric } from "@/types";

interface RepDashboardProps {
  user: SessionUser;
}

export async function RepDashboard({ user }: RepDashboardProps) {
  const now    = new Date();
  const month  = currentMonthPeriod(now);
  const { periodStart, periodEnd } = month;

  const [salesAgg, prevSalesAgg, collectionsAgg, prevCollAgg, visitsCount, prevVisits, openTasks, targets] =
    await Promise.all([
      prisma.salesOrder.aggregate({
        where: { repId: user.id, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { total: true },
      }),
      prisma.salesOrder.aggregate({
        where: {
          repId: user.id,
          status: "collected",
          collectedAt: {
            gte: new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000),
            lt:  periodStart,
          },
        },
        _sum: { total: true },
      }),
      prisma.collection.aggregate({
        where: { repId: user.id, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      }),
      prisma.collection.aggregate({
        where: {
          repId: user.id,
          isCancelled: false,
          collectedAt: {
            gte: new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000),
            lt:  periodStart,
          },
        },
        _sum: { amount: true },
      }),
      prisma.visit.count({ where: { repId: user.id, visitedAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.visit.count({
        where: {
          repId: user.id,
          visitedAt: {
            gte: new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000),
            lt:  periodStart,
          },
        },
      }),
      prisma.task.count({
        where: { assignedToId: user.id, status: { in: ["pending", "in_progress", "blocked"] } },
      }),
      prisma.target.findMany({
        where: { userId: user.id, periodStart },
        select: { metric: true, value: true, periodStart: true, periodEnd: true },
      }),
    ]);

  const sales       = Number(salesAgg._sum.total ?? 0);
  const prevSales   = Number(prevSalesAgg._sum.total ?? 0);
  const collections = Number(collectionsAgg._sum.amount ?? 0);
  const prevColl    = Number(prevCollAgg._sum.amount ?? 0);

  const salesDelta   = prevSales   > 0 ? ((sales - prevSales) / prevSales) * 100       : 0;
  const collDelta    = prevColl    > 0 ? ((collections - prevColl) / prevColl) * 100   : 0;
  const visitsDelta  = prevVisits  > 0 ? ((visitsCount - prevVisits) / prevVisits) * 100 : 0;

  const actuals: Record<TargetMetric, number> = {
    sales_amount:       sales,
    collections_amount: collections,
    visits_count:       visitsCount,
  };

  const achievements = targets.map((t) =>
    computeAchievementMetrics(
      { metric: t.metric as TargetMetric, target: Number(t.value), actual: actuals[t.metric as TargetMetric], periodStart: t.periodStart, periodEnd: t.periodEnd },
      now
    )
  );

  // Weekly activity (last 7 days)
  const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weeklyVisits = await prisma.visit.groupBy({
    by:    ["visitedAt"],
    where: { repId: user.id, visitedAt: { gte: weekStart } },
    _count: { id: true },
  });
  void weeklyVisits; // available for future chart use

  // Active competitions for rep
  const activeCompetitions = await prisma.competition.findMany({
    where: { status: "active", startDate: { lte: now }, endDate: { gte: now } },
    select: { id: true, name: true, endDate: true, prize: true },
    orderBy: { endDate: "asc" },
    take: 3,
  });

  return (
    <div className="space-y-6">
      {/* Hero KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="مبيعات الشهر"
          value={formatSAR(sales)}
          delta={salesDelta}
          icon={ShoppingCart}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          label="تحصيلات الشهر"
          value={formatSAR(collections)}
          delta={collDelta}
          icon={Wallet}
          iconColor="text-success-600"
          iconBg="bg-success-50"
        />
        <StatCard
          label="زيارات الشهر"
          value={formatNumber(visitsCount)}
          delta={visitsDelta}
          icon={MapPin}
          iconColor="text-warning-600"
          iconBg="bg-warning-50"
        />
        <StatCard
          label="مهام مفتوحة"
          value={formatNumber(openTasks)}
          icon={ClipboardList}
          iconColor="text-chart-5"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Progress cards */}
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

      {/* Active competitions */}
      {activeCompetitions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">المنافسات الجارية</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeCompetitions.map((c) => {
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
