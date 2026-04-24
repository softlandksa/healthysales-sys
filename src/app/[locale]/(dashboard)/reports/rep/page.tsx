import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getRepReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { ExportMenu } from "@/components/reports/ExportMenu";
import { StatCard } from "@/components/kpi/stat-card";
import { BarChart } from "@/components/charts/bar-chart";
import { formatSAR, formatNumber } from "@/lib/utils";
import { ShoppingCart, MapPin, Wallet, TrendingUp } from "lucide-react";
import { currentMonthPeriod } from "@/lib/targets/periods";

export const metadata: Metadata = { title: "تقرير المندوب" };

interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export default async function RepReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();

  const now   = new Date();
  const month = currentMonthPeriod(now);

  const defaultFrom = month.periodStart;
  const defaultTo   = now;

  const from  = parseDate(sp.from, defaultFrom);
  const to    = parseDate(sp.to, defaultTo);
  to.setHours(23, 59, 59, 999);

  const repId = user.role === "sales_rep" ? user.id : (sp.repId ?? user.id);

  const data = await getRepReport({ repId, from, to }).catch(() => null);

  const exportParams = {
    repId,
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };

  const chartData = data?.monthlyTrend.map((m) => ({
    month:       m.month,
    sales:       m.sales,
    collections: m.collections,
    visits:      m.visits,
  })) ?? [];

  return (
    <ReportShell
      title="تقرير المندوب"
      description={data?.rep.name ?? repId}
      type="rep"
      exportParams={exportParams}
    >
      <div className="flex items-center justify-between gap-4 print:hidden">
        <DateRangeFilter />
        <ExportMenu type="rep" params={exportParams} />
      </div>

      {!data ? (
        <p className="text-center text-text-secondary py-12">لا توجد بيانات لهذه الفترة</p>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="المبيعات المحصَّلة" value={formatSAR(data.summary.totalSales)}
              icon={ShoppingCart} iconColor="text-brand-600" iconBg="bg-brand-50" />
            <StatCard label="التحصيلات" value={formatSAR(data.summary.totalCollections)}
              icon={Wallet} iconColor="text-success-600" iconBg="bg-success-50" />
            <StatCard label="الزيارات" value={formatNumber(data.summary.totalVisits)}
              icon={MapPin} iconColor="text-warning-600" iconBg="bg-warning-50" />
            <StatCard label="متوسط الطلب" value={formatSAR(data.summary.avgOrderValue)}
              icon={TrendingUp} iconColor="text-chart-5" iconBg="bg-purple-50" />
          </div>

          {/* Monthly trend chart */}
          {chartData.length > 0 && (
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">الاتجاه الشهري</h3>
              <BarChart
                data={chartData}
                xKey="month"
                series={[
                  { key: "sales",       label: "المبيعات",    color: "#2563eb" },
                  { key: "collections", label: "التحصيلات",   color: "#16a34a" },
                ]}
                height={220}
                valueFormatter={(v) => formatSAR(v)}
              />
            </div>
          )}

          {/* Top customers + products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">أفضل العملاء</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-text-secondary text-xs">
                  <th className="text-right py-1">العميل</th>
                  <th className="text-right py-1">المبيعات</th>
                  <th className="text-right py-1">الزيارات</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {data.topCustomers.map((c) => (
                    <tr key={c.customerId}>
                      <td className="py-1.5 text-text-primary">{c.customerName}</td>
                      <td className="py-1.5 num text-text-secondary">{formatSAR(c.sales)}</td>
                      <td className="py-1.5 num text-center text-text-secondary">{c.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">أفضل المنتجات</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-text-secondary text-xs">
                  <th className="text-right py-1">المنتج</th>
                  <th className="text-right py-1">الوحدات</th>
                  <th className="text-right py-1">الإيراد</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {data.topProducts.map((p) => (
                    <tr key={p.productId}>
                      <td className="py-1.5 text-text-primary">{p.productName}</td>
                      <td className="py-1.5 num text-center text-text-secondary">{formatNumber(p.units)}</td>
                      <td className="py-1.5 num text-text-secondary">{formatSAR(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </ReportShell>
  );
}
