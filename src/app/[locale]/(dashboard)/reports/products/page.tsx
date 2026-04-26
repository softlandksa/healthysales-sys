import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ReportShell } from "@/components/reports/ReportShell";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { formatSAR, formatNumber } from "@/lib/utils";
import { Package, CheckCircle, XCircle } from "lucide-react";

export const metadata: Metadata = { title: "تقرير المنتجات" };
interface Props { searchParams: Promise<Record<string, string>> }

const ACTIVE_OPTIONS = [
  { value: "active",   label: "نشط" },
  { value: "inactive", label: "غير نشط" },
];

export default async function ProductsReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  await requireUser();

  const activeFilter = sp.active; // "active" | "inactive" | undefined
  const isActiveWhere =
    activeFilter === "active"   ? { isActive: true  } :
    activeFilter === "inactive" ? { isActive: false } :
    {};

  const exportParams: Record<string, string> = {
    ...(activeFilter ? { active: activeFilter } : {}),
  };

  const [productsR, summaryR] = await Promise.allSettled([
    prisma.product.findMany({
      where: isActiveWhere,
      orderBy: { nameAr: "asc" },
    }),
    prisma.product.groupBy({
      by: ["isActive"],
      _count: { id: true },
    }),
  ] as const);

  const products = productsR.status === "fulfilled" ? productsR.value : [];
  const summary  = summaryR.status  === "fulfilled" ? summaryR.value  : [];

  const totalProducts  = products.length;
  const activeCount    = summary.find((g) => g.isActive === true)?._count.id  ?? 0;
  const inactiveCount  = summary.find((g) => g.isActive === false)?._count.id ?? 0;

  return (
    <ReportShell title="تقرير المنتجات" description="كتالوج المنتجات وحالتها" type="products" exportParams={exportParams}>
      {/* Active filter */}
      <div className="card p-4 flex flex-wrap items-end gap-4 print:hidden">
        <SelectFilter
          paramKey="active"
          label="الحالة"
          options={ACTIVE_OPTIONS}
          {...(activeFilter ? { currentValue: activeFilter } : {})}
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-brand-50 w-fit">
            <Package size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(totalProducts)}</p>
            <p className="text-sm text-text-secondary mt-0.5">إجمالي المنتجات</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-success-50 w-fit">
            <CheckCircle size={18} className="text-success-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-success-700">{formatNumber(activeCount)}</p>
            <p className="text-sm text-text-secondary mt-0.5">منتجات نشطة</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-neutral-100 w-fit">
            <XCircle size={18} className="text-neutral-500" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-secondary">{formatNumber(inactiveCount)}</p>
            <p className="text-sm text-text-secondary mt-0.5">منتجات غير نشطة</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-primary text-sm">قائمة المنتجات</h3>
          <span className="text-xs text-text-muted num">{products.length} منتج</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الكود</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الاسم</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الوحدة</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">السعر</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-text-secondary">
                    لا توجد منتجات
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-1 transition-colors">
                    <td className="py-2.5 px-4 num text-xs text-text-secondary">{p.code}</td>
                    <td className="py-2.5 px-4 font-medium text-text-primary">{p.nameAr}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{p.unit}</td>
                    <td className="py-2.5 px-4 num text-text-secondary">
                      {Number(p.price) > 0 ? formatSAR(Number(p.price)) : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex text-xs px-2.5 py-0.5 rounded-badge font-medium border ${
                        p.isActive
                          ? "bg-success-50 text-success-700 border-success-200"
                          : "bg-neutral-100 text-neutral-600 border-neutral-200"
                      }`}>
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
    </ReportShell>
  );
}
