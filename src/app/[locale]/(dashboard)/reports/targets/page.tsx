import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { formatSAR, formatNumber, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { TARGET_METRIC_LABELS, TARGET_PERIOD_LABELS } from "@/types";
import type { TargetMetric } from "@/types";
import { Target } from "lucide-react";

export const metadata: Metadata = { title: "تقرير الأهداف" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

function pctColor(pct: number): string {
  if (pct >= 100) return "text-success-700";
  if (pct >= 70)  return "text-warning-600";
  return "text-danger-600";
}

function pctBg(pct: number): string {
  if (pct >= 100) return "bg-success-500";
  if (pct >= 70)  return "bg-warning-500";
  return "bg-danger-500";
}

export default async function TargetsReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart, periodEnd } = currentMonthPeriod(now);

  const from = parseDate(sp.from, periodStart);
  const to   = parseDate(sp.to, periodEnd);
  to.setHours(23, 59, 59, 999);

  const isRep = user.role === "sales_rep";
  const userScope = isRep ? { userId: user.id } : {};

  const exportParams: Record<string, string> = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };

  const [targetsR] = await Promise.allSettled([
    prisma.target.findMany({
      where: {
        ...userScope,
        periodStart: { gte: from, lte: to },
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ periodStart: "desc" }, { metric: "asc" }],
    }),
  ] as const);

  const targets = targetsR.status === "fulfilled" ? targetsR.value : [];

  // Batch-fetch actuals for all (userId, periodStart) combos in current month
  const uniqueUsers  = [...new Set(targets.map((t) => t.userId))];
  const uniquePeriod = targets.find((t) =>
    t.periodStart >= periodStart && t.periodEnd <= periodEnd
  );

  let salesMap  = new Map<string, number>();
  let collMap   = new Map<string, number>();
  let visitMap  = new Map<string, number>();

  if (uniqueUsers.length > 0 && uniquePeriod) {
    const [salesG, collG, visitG] = await Promise.allSettled([
      prisma.salesOrder.groupBy({
        by: ["repId"],
        where: { repId: { in: uniqueUsers }, status: "collected", collectedAt: { gte: uniquePeriod.periodStart, lte: uniquePeriod.periodEnd } },
        _sum: { total: true },
      }),
      prisma.collection.groupBy({
        by: ["repId"],
        where: { repId: { in: uniqueUsers }, isCancelled: false, collectedAt: { gte: uniquePeriod.periodStart, lte: uniquePeriod.periodEnd } },
        _sum: { amount: true },
      }),
      prisma.visit.groupBy({
        by: ["repId"],
        where: { repId: { in: uniqueUsers }, visitedAt: { gte: uniquePeriod.periodStart, lte: uniquePeriod.periodEnd } },
        _count: { id: true },
      }),
    ] as const);

    if (salesG.status  === "fulfilled") salesMap  = new Map(salesG.value.map((g)  => [g.repId, Number(g._sum.total ?? 0)]));
    if (collG.status   === "fulfilled") collMap   = new Map(collG.value.map((g)   => [g.repId, Number(g._sum.amount ?? 0)]));
    if (visitG.status  === "fulfilled") visitMap  = new Map(visitG.value.map((g)  => [g.repId, g._count.id]));
  }

  function getActual(userId: string, metric: TargetMetric, tPeriodStart: Date): number | null {
    if (!uniquePeriod || tPeriodStart.getTime() !== uniquePeriod.periodStart.getTime()) return null;
    if (metric === "sales_amount")       return salesMap.get(userId)  ?? 0;
    if (metric === "collections_amount") return collMap.get(userId)   ?? 0;
    if (metric === "visits_count")       return visitMap.get(userId)  ?? 0;
    return null;
  }

  const avgAchievement = targets.reduce((sum, t) => {
    const actual = getActual(t.userId, t.metric as TargetMetric, t.periodStart);
    if (actual === null) return sum;
    return sum + Math.min(100, (actual / Math.max(1, Number(t.value))) * 100);
  }, 0) / Math.max(1, targets.filter((t) => getActual(t.userId, t.metric as TargetMetric, t.periodStart) !== null).length);

  return (
    <ReportShell title="تقرير الأهداف" description="أهداف المندوبين والإنجاز الفعلي" type="targets" exportParams={exportParams}>
      <DateRangeFilter />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-brand-50 w-fit">
            <Target size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(targets.length)}</p>
            <p className="text-sm text-text-secondary mt-0.5">إجمالي الأهداف</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-success-50 w-fit">
            <Target size={18} className="text-success-600" />
          </div>
          <div>
            <p className={cn("text-2xl font-bold num", pctColor(avgAchievement))}>{formatPercent(avgAchievement)}</p>
            <p className="text-sm text-text-secondary mt-0.5">متوسط الإنجاز (الشهر الحالي)</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-warning-50 w-fit">
            <Target size={18} className="text-warning-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(uniqueUsers.length)}</p>
            <p className="text-sm text-text-secondary mt-0.5">مندوبون لديهم أهداف</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-primary text-sm">تفاصيل الأهداف</h3>
          <span className="text-xs text-text-muted num">{targets.length} هدف</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المؤشر</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الهدف</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الفعلي</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الإنجاز</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الفترة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {targets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-text-secondary">
                    لا توجد أهداف في هذه الفترة
                  </td>
                </tr>
              ) : (
                targets.map((t) => {
                  const actual  = getActual(t.userId, t.metric as TargetMetric, t.periodStart);
                  const target  = Number(t.value);
                  const pct     = actual !== null ? Math.min(200, (actual / Math.max(1, target)) * 100) : null;
                  const isMoney = t.metric !== "visits_count";
                  return (
                    <tr key={t.id} className="hover:bg-surface-1 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-text-primary">
                        {t.user.name ?? t.user.email}
                      </td>
                      <td className="py-2.5 px-4 text-text-secondary">
                        {TARGET_METRIC_LABELS[t.metric as TargetMetric]}
                      </td>
                      <td className="py-2.5 px-4 num font-semibold text-text-primary">
                        {isMoney ? formatSAR(target) : formatNumber(target)}
                      </td>
                      <td className="py-2.5 px-4 num text-text-secondary">
                        {actual !== null
                          ? (isMoney ? formatSAR(actual) : formatNumber(actual))
                          : <span className="text-text-muted text-xs">—</span>
                        }
                      </td>
                      <td className="py-2.5 px-4">
                        {pct !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden min-w-16">
                              <div
                                className={cn("h-full rounded-full transition-all", pctBg(pct))}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className={cn("num text-xs font-semibold min-w-10", pctColor(pct))}>
                              {formatPercent(pct)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-text-secondary text-xs">
                        {TARGET_PERIOD_LABELS[t.period as keyof typeof TARGET_PERIOD_LABELS] ?? t.period}
                        <span className="block num text-text-muted">
                          {t.periodStart.toLocaleDateString("ar-SA")}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
