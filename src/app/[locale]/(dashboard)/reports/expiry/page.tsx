import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getExpiryReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { ExpiryStatusFilter } from "@/components/reports/ExpiryStatusFilter";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ExpiryStatus } from "@/lib/reports/types";

export const metadata: Metadata = { title: "تقرير صلاحية المنتجات" };

interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

const STATUS_LABEL: Record<ExpiryStatus, string> = {
  fresh:    "سليم",
  warning:  "تحذير",
  critical: "حرج",
  expired:  "منتهي",
};

const STATUS_COLOR: Record<ExpiryStatus, string> = {
  fresh:    "bg-success-50 text-success-700 border-success-200",
  warning:  "bg-warning-50 text-warning-700 border-warning-200",
  critical: "bg-danger-50 text-danger-700 border-danger-200",
  expired:  "bg-neutral-100 text-text-secondary border-border",
};

const STATUS_BADGE: Record<ExpiryStatus, string> = {
  fresh:    "bg-success-50 text-success-700 border-success-200",
  warning:  "bg-warning-50 text-warning-700 border-warning-200",
  critical: "bg-danger-50 text-danger-700 border-danger-200",
  expired:  "bg-neutral-100 text-neutral-600 border-neutral-200",
};

export default async function ExpiryReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();

  const from         = parseDate(sp.from, new Date(now.getFullYear(), now.getMonth() - 6, 1));
  const to           = parseDate(sp.to,   new Date(now.getFullYear(), now.getMonth() + 6, 0));
  const statusFilter = (sp.status as ExpiryStatus) || undefined;
  const repFilter    = user.role === "sales_rep" ? user.id : (sp.repId || undefined);

  const data = await getExpiryReport({
    from,
    to,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(repFilter    ? { repId: repFilter }     : {}),
  }).catch(() => null);

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(repFilter    ? { repId: repFilter }     : {}),
  };

  const allStatuses: ExpiryStatus[] = ["fresh", "warning", "critical", "expired"];

  return (
    <ReportShell title="تقرير صلاحية المنتجات" type="expiry" exportParams={exportParams}>
      <DateRangeFilter
        extraFilters={<ExpiryStatusFilter currentStatus={statusFilter} />}
      />

      {!data ? (
        <p className="text-center text-text-secondary py-12">لا توجد بيانات في هذه الفترة</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {allStatuses.map((s) => (
              <div key={s} className={cn("card p-4 border", STATUS_COLOR[s])}>
                <p className="text-xs font-semibold">{STATUS_LABEL[s]}</p>
                <p className="text-3xl font-bold num mt-1">{formatNumber(data.summary[s])}</p>
                <p className="text-xs mt-0.5 opacity-70">صنف</p>
              </div>
            ))}
          </div>

          {/* Items table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-text-primary text-sm">تفاصيل الأصناف</h3>
              <span className="text-xs text-text-muted num">{data.items.length} صنف</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">طلب البيع</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المنتج</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الكمية</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">تاريخ الانتهاء</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الأيام المتبقية</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-text-secondary">
                        لا توجد عناصر تطابق المرشحات المحددة
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item) => (
                      <tr key={item.orderItemId} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 num text-text-secondary text-xs">{item.orderCode}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-medium text-text-primary">{item.productName}</span>
                          <span className="block text-xs text-text-muted num">{item.productCode}</span>
                        </td>
                        <td className="py-2.5 px-4 text-text-secondary">{item.repName ?? "—"}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">{item.quantity}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">
                          {item.expiryDate.toLocaleDateString("ar-SA")}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={cn(
                            "num text-sm font-semibold",
                            item.daysUntilExpiry < 0   ? "text-neutral-500" :
                            item.daysUntilExpiry < 30  ? "text-danger-600"  :
                            item.daysUntilExpiry < 90  ? "text-warning-600" : "text-success-600"
                          )}>
                            {item.daysUntilExpiry < 0
                              ? `منتهي منذ ${Math.abs(item.daysUntilExpiry)} يوم`
                              : item.daysUntilExpiry === 0
                              ? "ينتهي اليوم"
                              : `${item.daysUntilExpiry} يوم`}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={cn(
                            "inline-flex items-center text-xs px-2.5 py-0.5 rounded-badge font-medium border",
                            STATUS_BADGE[item.status]
                          )}>
                            {STATUS_LABEL[item.status]}
                          </span>
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
