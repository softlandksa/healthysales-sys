import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getExpiryReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ExpiryStatus } from "@/lib/reports/types";

export const metadata: Metadata = { title: "تقرير الصلاحية" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d;
}

const STATUS_LABEL: Record<ExpiryStatus, string> = {
  fresh:    "سليم",
  warning:  "تحذير",
  critical: "حرج",
  expired:  "منتهي",
};
const STATUS_COLOR: Record<ExpiryStatus, string> = {
  fresh:    "bg-success-50 text-success-700",
  warning:  "bg-warning-50 text-warning-700",
  critical: "bg-danger-50 text-danger-700",
  expired:  "bg-neutral-100 text-text-secondary",
};

export default async function ExpiryReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();

  // Default: show next 6 months from today
  const from = parseDate(sp.from, new Date(now.getFullYear(), now.getMonth() - 6, 1));
  const to   = parseDate(sp.to, new Date(now.getFullYear(), now.getMonth() + 6, 0));

  const statusFilter = sp.status as ExpiryStatus | undefined;
  const data = await getExpiryReport({ from, to, ...(statusFilter ? { status: statusFilter } : {}) }).catch(() => null);

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(user.role === "sales_rep" ? { repId: user.id } : {}),
  };

  return (
    <ReportShell title="تقرير الصلاحية" type="expiry" exportParams={exportParams}>
      <DateRangeFilter />

      {!data ? (
        <p className="text-center text-text-secondary py-12">لا توجد بيانات</p>
      ) : (
        <>
          {/* Summary counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(["fresh", "warning", "critical", "expired"] as ExpiryStatus[]).map((s) => (
              <div key={s} className={cn("card p-4", STATUS_COLOR[s])}>
                <p className="text-xs font-medium">{STATUS_LABEL[s]}</p>
                <p className="text-2xl font-bold num mt-1">{formatNumber(data.summary[s])}</p>
              </div>
            ))}
          </div>

          {/* Items table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الطلب</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المنتج</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الكمية</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">تاريخ الانتهاء</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الأيام</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-text-secondary">لا توجد عناصر</td></tr>
                  )}
                  {data.items.map((item) => (
                    <tr key={item.orderItemId} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 num text-text-secondary">{item.orderCode}</td>
                      <td className="py-2.5 px-4 text-text-primary">{item.productName}</td>
                      <td className="py-2.5 px-4 text-text-secondary">{item.repName ?? "—"}</td>
                      <td className="py-2.5 px-4 num text-text-secondary">{item.quantity}</td>
                      <td className="py-2.5 px-4 num text-text-secondary">
                        {item.expiryDate.toLocaleDateString("ar-SA")}
                      </td>
                      <td className="py-2.5 px-4 num font-medium">
                        <span className={cn(
                          "px-2 py-0.5 rounded-badge text-xs",
                          item.daysUntilExpiry < 0 ? "text-text-secondary" :
                          item.daysUntilExpiry < 30 ? "text-danger-600 font-bold" :
                          item.daysUntilExpiry < 90 ? "text-warning-600" : "text-success-600"
                        )}>
                          {item.daysUntilExpiry < 0 ? "منتهي" : `${item.daysUntilExpiry} يوم`}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={cn("text-xs px-2 py-0.5 rounded-badge font-medium", STATUS_COLOR[item.status])}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </td>
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
