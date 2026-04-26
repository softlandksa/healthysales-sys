import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getTargetsReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { StatCard } from "@/components/kpi/stat-card";
import { formatSAR, formatNumber, formatPercent, cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { TARGET_METRIC_LABELS, TARGET_PERIOD_LABELS, type TargetMetric, type TargetPeriod } from "@/types";
import { Target, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "تقرير الأهداف" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

const METRIC_OPTIONS = (Object.keys(TARGET_METRIC_LABELS) as TargetMetric[]).map((k) => ({
  value: k,
  label: TARGET_METRIC_LABELS[k],
}));

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

  const from         = parseDate(sp.from, periodStart);
  const to           = parseDate(sp.to, periodEnd);
  to.setHours(23, 59, 59, 999);
  const metricFilter = sp.metric || undefined;

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(metricFilter              ? { metric: metricFilter } : {}),
    ...(user.role === "sales_rep" ? { userId: user.id }      : {}),
  };

  const data = await getTargetsReport({ from, to, ...(metricFilter ? { metric: metricFilter } : {}) }).catch(() => null);

  return (
    <ReportShell
      title="تقرير الأهداف"
      description="أهداف المندوبين مقابل الإنجاز الفعلي مع نسب التحقق"
      type="targets"
      exportParams={exportParams}
    >
      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-end gap-4 print:hidden">
        <DateRangeFilter
          extraFilters={
            <SelectFilter
              paramKey="metric"
              label="المؤشر"
              options={METRIC_OPTIONS}
              {...(metricFilter ? { currentValue: metricFilter } : {})}
            />
          }
        />
      </div>

      {!data ? (
        <div className="card p-12 text-center text-text-secondary">
          <Target size={40} className="mx-auto mb-3 text-text-muted" />
          <p className="font-medium">لا توجد أهداف لهذه الفترة</p>
          <p className="text-sm mt-1">جرب تغيير نطاق التاريخ أو المرشحات</p>
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="إجمالي الأهداف"     value={formatNumber(data.summary.totalTargets)}
              icon={Target}        iconColor="text-blue-600"    iconBg="bg-blue-50" />
            <StatCard label="متوسط الإنجاز"      value={formatPercent(data.summary.avgAchievement)}
              icon={TrendingUp}    iconColor="text-amber-600"   iconBg="bg-amber-50" />
            <StatCard label="أهداف محققة (100%)" value={formatNumber(data.summary.fullyAchieved)}
              icon={CheckCircle}   iconColor="text-success-600" iconBg="bg-success-50" />
            <StatCard label="في خطر (أقل من 70%)" value={formatNumber(data.summary.atRisk)}
              icon={AlertTriangle} iconColor="text-danger-600"  iconBg="bg-danger-50" />
          </div>

          {/* By metric */}
          {data.byMetric.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {data.byMetric.map((m) => (
                <div key={m.metric} className="card p-5" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 65%)" }}>
                  <p className="text-sm font-semibold text-text-primary">
                    {TARGET_METRIC_LABELS[m.metric as TargetMetric] ?? m.metric}
                  </p>
                  <p className="text-2xl font-bold num mt-2 text-blue-700">{formatPercent(m.avgAchievement)}</p>
                  <p className="text-xs text-text-secondary mt-0.5">متوسط الإنجاز · {m.count} هدف</p>
                </div>
              ))}
            </div>
          )}

          {/* Targets table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">تفاصيل الأهداف</h3>
              <span className="text-xs text-text-muted num">{data.targets.length} هدف</span>
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
                  {data.targets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-text-secondary">
                        لا توجد أهداف في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    data.targets.map((t) => {
                      const isMoney = t.metric !== "visits_count";
                      return (
                        <tr key={t.id} className="hover:bg-surface-1 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-text-primary">{t.userName ?? t.userId}</td>
                          <td className="py-2.5 px-4 text-text-secondary">
                            {TARGET_METRIC_LABELS[t.metric as TargetMetric] ?? t.metric}
                          </td>
                          <td className="py-2.5 px-4 num font-semibold text-text-primary">
                            {isMoney ? formatSAR(t.targetValue) : formatNumber(t.targetValue)}
                          </td>
                          <td className="py-2.5 px-4 num text-text-secondary">
                            {t.actual !== null
                              ? (isMoney ? formatSAR(t.actual) : formatNumber(t.actual))
                              : <span className="text-text-muted text-xs">—</span>}
                          </td>
                          <td className="py-2.5 px-4">
                            {t.pct !== null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden min-w-16">
                                  <div
                                    className={cn("h-full rounded-full transition-all", pctBg(t.pct))}
                                    style={{ width: `${Math.min(100, t.pct)}%` }}
                                  />
                                </div>
                                <span className={cn("num text-xs font-semibold min-w-10", pctColor(t.pct))}>
                                  {formatPercent(t.pct)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-text-muted text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-text-secondary text-xs">
                            {TARGET_PERIOD_LABELS[t.period as TargetPeriod] ?? t.period}
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
        </>
      )}
    </ReportShell>
  );
}
