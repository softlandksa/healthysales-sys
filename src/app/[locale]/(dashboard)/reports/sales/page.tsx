import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { formatSAR, formatNumber } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { ShoppingCart, FileText, CheckCircle, XCircle } from "lucide-react";
import { ORDER_STATUS_LABELS, type SalesOrderStatus } from "@/types";

export const metadata: Metadata = { title: "تقرير المبيعات" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

const STATUS_OPTIONS = (Object.keys(ORDER_STATUS_LABELS) as SalesOrderStatus[]).map((k) => ({
  value: k,
  label: ORDER_STATUS_LABELS[k],
}));

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
  draft:     "bg-neutral-100 text-neutral-600 border-neutral-200",
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

  const from   = parseDate(sp.from, periodStart);
  const to     = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const statusFilter = (sp.status as SalesOrderStatus) || undefined;
  const isRep        = user.role === "sales_rep";
  const repScope     = isRep ? { repId: user.id } : {};

  const exportParams: Record<string, string> = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(isRep ? { repId: user.id } : {}),
  };

  const [ordersR, summaryR] = await Promise.allSettled([
    prisma.salesOrder.findMany({
      where: {
        ...repScope,
        createdAt: { gte: from, lte: to },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        customer: { select: { nameAr: true, code: true } },
        rep:      { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.salesOrder.groupBy({
      by: ["status"],
      where: { ...repScope, createdAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum:   { total: true },
    }),
  ] as const);

  const orders  = ordersR.status  === "fulfilled" ? ordersR.value  : [];
  const summary = summaryR.status === "fulfilled" ? summaryR.value : [];

  const totalOrders = orders.length;
  const totalAmount = orders.reduce((s, o) => s + Number(o.total), 0);
  const confirmed   = summary.find((g) => g.status === "confirmed")?._count.id ?? 0;
  const collected   = summary.find((g) => g.status === "collected")?._count.id ?? 0;

  return (
    <ReportShell title="تقرير المبيعات" description="طلبات البيع خلال الفترة المحددة" type="sales" exportParams={exportParams}>
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

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-brand-50 w-fit">
            <ShoppingCart size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(totalOrders)}</p>
            <p className="text-sm text-text-secondary mt-0.5">إجمالي الطلبات</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-success-50 w-fit">
            <FileText size={18} className="text-success-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatSAR(totalAmount)}</p>
            <p className="text-sm text-text-secondary mt-0.5">إجمالي المبالغ</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-warning-50 w-fit">
            <CheckCircle size={18} className="text-warning-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(confirmed)}</p>
            <p className="text-sm text-text-secondary mt-0.5">طلبات مؤكدة</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-success-50 w-fit">
            <XCircle size={18} className="text-success-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(collected)}</p>
            <p className="text-sm text-text-secondary mt-0.5">طلبات محصَّلة</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-primary text-sm">تفاصيل الطلبات</h3>
          <span className="text-xs text-text-muted num">{orders.length} طلب</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الكود</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">العميل</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المبلغ</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-text-secondary">
                    لا توجد طلبات في هذه الفترة
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-1 transition-colors">
                    <td className="py-2.5 px-4 num text-xs text-text-secondary">{o.code}</td>
                    <td className="py-2.5 px-4 font-medium text-text-primary">{o.customer.nameAr}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{o.rep.name ?? "—"}</td>
                    <td className="py-2.5 px-4 num font-semibold text-text-primary">{formatSAR(Number(o.total))}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex text-xs px-2.5 py-0.5 rounded-badge font-medium border ${STATUS_BADGE[o.status as SalesOrderStatus]}`}>
                        {ORDER_STATUS_LABELS[o.status as SalesOrderStatus]}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 num text-xs text-text-secondary">
                      {o.createdAt.toLocaleDateString("ar-SA")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
