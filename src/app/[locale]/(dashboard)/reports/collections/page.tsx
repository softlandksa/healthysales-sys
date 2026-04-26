import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getCollectionsReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { BarChart } from "@/components/charts/bar-chart";
import { StatCard } from "@/components/kpi/stat-card";
import { formatSAR, formatNumber } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { currentMonthPeriod } from "@/lib/targets/periods";

export const metadata: Metadata = { title: "تقرير التحصيلات" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d;
}

export default async function CollectionsReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from = parseDate(sp.from, periodStart);
  const to   = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const data = await getCollectionsReport({ from, to }).catch((e) => { console.error("[collections-report] fetch failed:", e); return null; });

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(user.role === "sales_rep" ? { repId: user.id } : {}),
  };

  const chartData = data?.monthlyTrend.map((m) => ({
    month:    m.month,
    نقدي:    m.cash,
    تحويل:   m.transfer,
    شيك:     m.check,
  })) ?? [];

  return (
    <ReportShell title="تقرير التحصيلات" type="collections" exportParams={exportParams}>
      <DateRangeFilter />

      {!data ? (
        <p className="text-center text-text-secondary py-12">لا توجد بيانات</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="إجمالي التحصيلات" value={formatSAR(data.summary.total)}
              icon={Wallet} iconColor="text-success-600" iconBg="bg-success-50" />
            <div className="card p-5">
              <p className="text-sm text-text-secondary">عدد العمليات</p>
              <p className="text-2xl font-bold num mt-1">{formatNumber(data.summary.count)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">متوسط التحصيل</p>
              <p className="text-2xl font-bold num mt-1">{formatSAR(data.summary.avgAmount)}</p>
            </div>
          </div>

          {/* By method */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data.byMethod.map((m) => (
              <div key={m.method} className="card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary">{m.label}</p>
                  <span className="text-xs text-text-secondary num">{m.pct}%</span>
                </div>
                <p className="text-xl font-bold num text-text-primary">{formatSAR(m.amount)}</p>
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${m.pct}%` }} />
                </div>
                <p className="text-xs text-text-secondary num">{formatNumber(m.count)} عملية</p>
              </div>
            ))}
          </div>

          {/* Monthly trend */}
          {chartData.length > 0 && (
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">الاتجاه الشهري حسب طريقة الدفع</h3>
              <BarChart
                data={chartData}
                xKey="month"
                series={[
                  { key: "نقدي",  label: "نقدي",           color: "#16a34a" },
                  { key: "تحويل", label: "تحويل بنكي",     color: "#2563eb" },
                  { key: "شيك",   label: "شيك",            color: "#d97706" },
                ]}
                height={220}
                valueFormatter={(v) => formatSAR(v)}
              />
            </div>
          )}

          {/* Top collectors */}
          {data.topCollectors.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">أفضل المحصّلين</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">#</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المبلغ</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">العمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.topCollectors.map((c, i) => (
                    <tr key={c.repId} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 num text-text-secondary font-medium">{i + 1}</td>
                      <td className="py-2.5 px-4 text-text-primary">{c.repName ?? c.repId}</td>
                      <td className="py-2.5 px-4 num font-semibold text-success-700">{formatSAR(c.amount)}</td>
                      <td className="py-2.5 px-4 num text-text-secondary">{c.count}</td>
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
