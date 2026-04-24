import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getCustomersReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { Badge } from "@/components/ui/badge";
import { formatSAR, formatNumber } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import type { CustomerCategory } from "@/lib/reports/types";

export const metadata: Metadata = { title: "تقرير العملاء" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d;
}

const CATEGORY_STYLE: Record<CustomerCategory, string> = {
  A: "bg-success-50 text-success-700 border-success-200",
  B: "bg-warning-50 text-warning-700 border-warning-200",
  C: "bg-neutral-100 text-text-secondary border-border",
};

export default async function CustomersReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from = parseDate(sp.from, periodStart);
  const to   = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const data = await getCustomersReport({ from, to }).catch(() => null);

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(user.role === "sales_rep" ? { repId: user.id } : {}),
  };

  return (
    <ReportShell title="تقرير العملاء" type="customers" exportParams={exportParams}>
      <DateRangeFilter />

      {!data ? (
        <p className="text-center text-text-secondary py-12">لا توجد بيانات</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-sm text-text-secondary">إجمالي العملاء</p>
              <p className="text-2xl font-bold num mt-1">{formatNumber(data.summary.totalCustomers)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">إجمالي الأرصدة المستحقة</p>
              <p className="text-2xl font-bold num mt-1 text-danger-600">{formatSAR(data.summary.totalOutstanding)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">متوسط الرصيد</p>
              <p className="text-2xl font-bold num mt-1">{formatSAR(data.summary.avgBalance)}</p>
            </div>
          </div>

          {/* Top buyers (ABC) */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">أفضل العملاء — تحليل ABC</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-border">
                <tr>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">#</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">العميل</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المبيعات</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الطلبات</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">التصنيف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topBuyers.map((b, i) => (
                  <tr key={b.customerId} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-4 num text-text-secondary">{i + 1}</td>
                    <td className="py-2.5 px-4 text-text-primary font-medium">{b.name}</td>
                    <td className="py-2.5 px-4 num text-text-secondary">{formatSAR(b.sales)}</td>
                    <td className="py-2.5 px-4 num text-text-secondary">{b.orders}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-badge border ${CATEGORY_STYLE[b.category]}`}>
                        {b.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Outstanding balances */}
          {data.highBalances.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">أعلى الأرصدة المستحقة</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">العميل</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الرصيد</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">حد الائتمان</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.highBalances.map((b) => (
                    <tr key={b.customerId} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 text-text-primary font-medium">{b.name}</td>
                      <td className="py-2.5 px-4 num text-danger-600 font-semibold">{formatSAR(b.balance)}</td>
                      <td className="py-2.5 px-4 num text-text-secondary">{b.creditLimit !== null ? formatSAR(b.creditLimit) : "—"}</td>
                      <td className="py-2.5 px-4 text-text-secondary">{b.repName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Visit frequency */}
          {data.visitFrequency.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">تكرار الزيارات</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">العميل</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">عدد الزيارات</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">آخر زيارة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.visitFrequency.map((v) => (
                    <tr key={v.customerId} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 text-text-primary">{v.name}</td>
                      <td className="py-2.5 px-4 num text-text-secondary">{v.visits}</td>
                      <td className="py-2.5 px-4 text-text-secondary">
                        {v.lastVisit ? v.lastVisit.toLocaleDateString("ar-SA") : "—"}
                      </td>
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
