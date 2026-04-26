import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getProductsReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { StatCard } from "@/components/kpi/stat-card";
import { formatSAR, formatNumber, cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { Package, CheckCircle, XCircle, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "تقرير المنتجات" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

const ACTIVE_OPTIONS = [
  { value: "active",   label: "نشط" },
  { value: "inactive", label: "غير نشط" },
];

export default async function ProductsReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  await requireUser();
  const now = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from         = parseDate(sp.from, periodStart);
  const to           = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);
  const activeFilter = sp.active;
  const isActive     = activeFilter === "active" ? true : activeFilter === "inactive" ? false : undefined;

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(activeFilter ? { active: activeFilter } : {}),
  };

  const data = await getProductsReport({ from, to, ...(isActive !== undefined ? { isActive } : {}) }).catch(() => null);

  return (
    <ReportShell
      title="تقرير المنتجات"
      description="كتالوج المنتجات مع الكميات المباعة وإيرادات الفترة"
      type="products"
      exportParams={exportParams}
    >
      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-end gap-4 print:hidden">
        <DateRangeFilter
          extraFilters={
            <SelectFilter
              paramKey="active"
              label="الحالة"
              options={ACTIVE_OPTIONS}
              {...(activeFilter ? { currentValue: activeFilter } : {})}
            />
          }
        />
      </div>

      {!data ? (
        <div className="card p-12 text-center text-text-secondary">
          <Package size={40} className="mx-auto mb-3 text-text-muted" />
          <p className="font-medium">لا توجد بيانات</p>
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="إجمالي المنتجات"  value={formatNumber(data.summary.total)}
              icon={Package}     iconColor="text-amber-600"   iconBg="bg-amber-50" />
            <StatCard label="نشطة"             value={formatNumber(data.summary.active)}
              icon={CheckCircle} iconColor="text-success-600" iconBg="bg-success-50" />
            <StatCard label="غير نشطة"         value={formatNumber(data.summary.inactive)}
              icon={XCircle}     iconColor="text-neutral-500" iconBg="bg-neutral-100" />
            <StatCard label="إيرادات الفترة"   value={formatSAR(data.summary.totalRevenue)}
              icon={TrendingUp}  iconColor="text-blue-600"    iconBg="bg-blue-50" />
          </div>

          {/* Products table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">قائمة المنتجات</h3>
              <span className="text-xs text-text-muted num">{data.products.length} منتج</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الكود</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الاسم</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الوحدة</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">السعر</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الكمية المباعة</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الإيراد</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-text-secondary">
                        لا توجد منتجات تطابق المرشحات
                      </td>
                    </tr>
                  ) : (
                    data.products.map((p) => (
                      <tr key={p.productId} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 num text-xs text-text-secondary">{p.productCode}</td>
                        <td className="py-2.5 px-4 font-medium text-text-primary">{p.productName}</td>
                        <td className="py-2.5 px-4 text-text-secondary">{p.unit}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">
                          {p.price > 0 ? formatSAR(p.price) : "—"}
                        </td>
                        <td className="py-2.5 px-4 num text-text-secondary">
                          {p.quantitySold > 0
                            ? <span className="font-medium text-amber-700">{formatNumber(p.quantitySold)}</span>
                            : <span className="text-text-muted">—</span>}
                        </td>
                        <td className="py-2.5 px-4 num">
                          {p.revenue > 0
                            ? <span className="font-semibold text-blue-700">{formatSAR(p.revenue)}</span>
                            : <span className="text-text-muted">—</span>}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={cn(
                            "inline-flex text-xs px-2.5 py-0.5 rounded-badge font-medium border",
                            p.isActive
                              ? "bg-success-50 text-success-700 border-success-200"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200"
                          )}>
                            {p.isActive ? "نشط" : "غير نشط"}
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
