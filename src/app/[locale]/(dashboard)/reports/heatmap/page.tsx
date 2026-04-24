import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getActivityHeatmap } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";

export const metadata: Metadata = { title: "خريطة النشاط" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d;
}

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const HOURS   = Array.from({ length: 24 }, (_, i) => i);

function heatColor(count: number, max: number): string {
  if (count === 0 || max === 0) return "bg-neutral-100";
  const ratio = count / max;
  if (ratio >= 0.8) return "bg-brand-700 text-white";
  if (ratio >= 0.6) return "bg-brand-500 text-white";
  if (ratio >= 0.4) return "bg-brand-300";
  if (ratio >= 0.2) return "bg-brand-100";
  return "bg-brand-50";
}

export default async function HeatmapReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from = parseDate(sp.from, periodStart);
  const to   = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const data = await getActivityHeatmap({ from, to }).catch(() => null);

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };

  // Build 7×24 grid
  const grid = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const cell = data?.heatmap.find((c) => c.dayOfWeek === d && c.hour === h);
      return cell?.count ?? 0;
    })
  );

  const maxCount = data ? Math.max(...data.heatmap.map((c) => c.count), 1) : 1;

  return (
    <ReportShell title="خريطة النشاط" description="توزيع الزيارات حسب اليوم والساعة" type="heatmap" exportParams={exportParams}>
      <DateRangeFilter />

      {!data || data.totalVisits === 0 ? (
        <p className="text-center text-text-secondary py-12">لا توجد بيانات</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-sm text-text-secondary">إجمالي الزيارات</p>
              <p className="text-2xl font-bold num mt-1">{formatNumber(data.totalVisits)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">أكثر يوم نشاطاً</p>
              <p className="text-2xl font-bold mt-1">{DAYS_AR[data.peakDay]}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">أكثر ساعة نشاطاً</p>
              <p className="text-2xl font-bold num mt-1">{data.peakHour}:00</p>
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">خريطة الحرارة — الزيارات حسب اليوم والساعة</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="w-20 text-right py-1 pe-2 text-text-secondary font-medium">اليوم \ الساعة</th>
                    {HOURS.filter((h) => h >= 6 && h <= 22).map((h) => (
                      <th key={h} className="w-8 text-center py-1 text-text-secondary font-normal num">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS_AR.map((day, d) => (
                    <tr key={d}>
                      <td className="py-0.5 pe-2 text-right text-text-secondary font-medium whitespace-nowrap">{day}</td>
                      {HOURS.filter((h) => h >= 6 && h <= 22).map((h) => {
                        const count = grid[d]?.[h] ?? 0;
                        return (
                          <td key={h} className="py-0.5 px-0.5">
                            <div
                              title={`${day} ${h}:00 — ${count} زيارة`}
                              className={cn(
                                "w-7 h-7 rounded flex items-center justify-center transition-all",
                                heatColor(count, maxCount)
                              )}
                            >
                              {count > 0 && <span className="num">{count}</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rep activity */}
          {data.repActivity.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">نشاط المندوبين</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">#</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">إجمالي الزيارات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.repActivity.map((r, i) => (
                    <tr key={r.repId} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 num text-text-secondary">{i + 1}</td>
                      <td className="py-2.5 px-4 text-text-primary">{r.repName ?? r.repId}</td>
                      <td className="py-2.5 px-4 num font-semibold">{formatNumber(r.totalVisits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ReportShell>
  );
}
