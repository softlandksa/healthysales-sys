import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getSalesReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { StatCard } from "@/components/kpi/stat-card";
import { formatSAR, formatNumber, cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { ORDER_STATUS_LABELS, type SalesOrderStatus } from "@/types";
import { ShoppingCart, TrendingUp, CheckCircle, Package } from "lucide-react";

export const metadata: Metadata = { title: "تقرير المبيعات" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

const STATUS_OPTIONS = [
  { value: "draft",     label: ORDER_STATUS_LABELS.draft     },
  { value: "confirmed", label: ORDER_STATUS_LABELS.confirmed },
  { value: "delivered", label: ORDER_STATUS_LABELS.delivered },
  { value: "collected", label: ORDER_STATUS_LABELS.collected },
  { value: "cancelled", label: ORDER_STATUS_LABELS.cancelled },
];

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-neutral-100 text-neutral-600 border-neutral-200",
  confirmed: "bg-warning-50 text-warning-700 border-warning-200",
  delivered: "bg-brand-50 text-brand-700 border-brand-200",
  collected: "bg-success-50 text-success-700 border-success-200",
  cancelled: "bg-danger-50 text-danger-700 border-danger-200",
};

const STATUS_CARD: Record<string, string> = {
  draft:     "bg-neutral-100 text-neutral-700 border-neutral-200",
  confirmed: "bg-warning-50 text-warning-700 border-warning-200",
  delivered: "bg-brand-50 text-brand-700 border-brand-200",
  collected: "bg-success-50 text-success-700 border-success-200",
  cancelled: "bg-danger-50 text-danger-700 border-danger-200",
};

export default async function SalesReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from         = parseDate(sp.from, periodStart);
  const to           = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);
  const statusFilter = sp.status || undefined;

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(statusFilter              ? { status: statusFilter } : {}),
    ...(user.role === "sales_rep" ? { repId: user.id }       : {}),
  };

  const data = await getSalesReport({ from, to, ...(statusFilter ? { status: statusFilter } : {}) }).catch((e) => { console.error("[sales-report] fetch failed:", e); return null; });

  const statusKeys: SalesOrderStatus[] = ["draft", "confirmed", "delivered", "collected", "cancelled"];
  const statusCount: Record<string, number> = {
    draft:     data ? (data.summary.totalOrders - data.summary.confirmedCount - data.summary.deliveredCount - data.summary.collectedCount - data.summary.cancelledCount) : 0,
    confirmed: data?.summary.confirmedCount ?? 0,
    delivered: data?.summary.deliveredCount ?? 0,
    collected: data?.summary.collectedCount ?? 0,
    cancelled: data?.summary.cancelledCount ?? 0,
  };

  return (
    <ReportShell
      title="تقرير المبيعات"
      description="طلبات البيع بالتفاصيل: المبالغ، الحالات، التواريخ"
      type="sales"
      exportParams={exportParams}
    >
      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-end gap-4 print:hidden">
        <DateRangeFilter
          extraFilters={
            <SelectFilter
              paramKey="status"
              label="الحالة"
              options={STATUS_OPTIONS}
              {...(statusFilter ? { currentValue: statusFilter } : {})}
            />
          }
        />
      </div>

      {!data ? (
        <div className="card p-12 text-center text-text-secondary">
          <ShoppingCart size={40} className="mx-auto mb-3 text-text-muted" />
          <p className="font-medium">لا توجد بيانات لهذه الفترة</p>
          <p className="text-sm mt-1">جرب تغيير نطاق التاريخ أو المرشحات</p>
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="إجمالي الطلبات"    value={formatNumber(data.summary.totalOrders)}
              icon={ShoppingCart} iconColor="text-blue-600"    iconBg="bg-blue-50" />
            <StatCard label="إجمالي المبيعات"   value={formatSAR(data.summary.totalAmount)}
              icon={TrendingUp}   iconColor="text-emerald-600" iconBg="bg-emerald-50" />
            <StatCard label="متوسط قيمة الطلب" value={formatSAR(data.summary.avgOrderValue)}
              icon={TrendingUp}   iconColor="text-amber-600"   iconBg="bg-amber-50" />
            <StatCard label="محصَّل"            value={formatNumber(data.summary.collectedCount)}
              icon={CheckCircle}  iconColor="text-success-600" iconBg="bg-success-50" />
          </div>

          {/* Status cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {statusKeys.map((s) => (
              <div key={s} className={cn("card p-4 border", STATUS_CARD[s])}>
                <p className="text-xs font-semibold">{ORDER_STATUS_LABELS[s]}</p>
                <p className="text-2xl font-bold num mt-1">{formatNumber(statusCount[s] ?? 0)}</p>
              </div>
            ))}
          </div>

          {/* By Rep */}
          {data.byRep.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">المبيعات حسب المندوب</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-1 border-b border-border">
                    <tr>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">#</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الطلبات</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.byRep.map((r, i) => (
                      <tr key={r.repId} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 num text-text-secondary">{i + 1}</td>
                        <td className="py-2.5 px-4 font-medium text-text-primary">{r.repName ?? r.repId}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">{formatNumber(r.orders)}</td>
                        <td className="py-2.5 px-4 num font-semibold text-blue-700">{formatSAR(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By Product */}
          {data.byProduct.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">أكثر المنتجات مبيعاً</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-1 border-b border-border">
                    <tr>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">#</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المنتج</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الوحدة</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الكمية</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الإيراد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.byProduct.map((p, i) => (
                      <tr key={p.productId} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 num text-text-secondary">{i + 1}</td>
                        <td className="py-2.5 px-4">
                          <p className="font-medium text-text-primary">{p.productName}</p>
                          <p className="text-xs text-text-muted num">{p.productCode}</p>
                        </td>
                        <td className="py-2.5 px-4 text-text-secondary">{p.unit}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">{formatNumber(p.quantity)}</td>
                        <td className="py-2.5 px-4 num font-semibold text-emerald-700">{formatSAR(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">تفاصيل الطلبات</h3>
              <span className="text-xs text-text-muted num">{data.orders.length} طلب</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">رقم الطلب</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">العميل</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الإجمالي</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-text-secondary">
                        <Package size={28} className="mx-auto mb-2 text-text-muted" />
                        لا توجد طلبات في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    data.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 num text-xs text-text-secondary">{o.code}</td>
                        <td className="py-2.5 px-4 font-medium text-text-primary">{o.customerName}</td>
                        <td className="py-2.5 px-4 text-text-secondary">{o.repName ?? "—"}</td>
                        <td className="py-2.5 px-4">
                          <span className={cn(
                            "inline-flex text-xs px-2.5 py-0.5 rounded-badge font-medium border",
                            STATUS_BADGE[o.status] ?? STATUS_BADGE.draft
                          )}>
                            {ORDER_STATUS_LABELS[o.status as SalesOrderStatus] ?? o.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 num font-semibold text-text-primary">{formatSAR(o.total)}</td>
                        <td className="py-2.5 px-4 num text-xs text-text-secondary whitespace-nowrap">
                          {o.createdAt.toLocaleDateString("ar-SA")}
                        </td>
                      </tr>
                    ))
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
