"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatSAR } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/types";
import type { SalesOrderRow } from "@/types";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface SalesOrdersTableProps {
  rows: SalesOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  status: string;
  from: string;
  to: string;
}

const STATUS_VARIANT_MAP: Record<string, "default" | "success" | "warning" | "danger" | "secondary"> = {
  draft:      "secondary",
  confirmed:  "warning",
  delivered:  "default",
  collected:  "success",
  cancelled:  "danger",
};

export function SalesOrdersTable({ rows, total, page, pageSize, status, from, to }: SalesOrdersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageCount = Math.ceil(total / pageSize);

  function updateParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    if (key !== "page") p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <select
          className="h-9 rounded-input border border-border bg-surface-0 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={status}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="confirmed">مؤكد</option>
          <option value="delivered">مُسلَّم</option>
          <option value="collected">محصَّل</option>
          <option value="cancelled">ملغى</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary whitespace-nowrap">من:</label>
          <Input type="date" defaultValue={from} className="w-36" onChange={(e) => updateParam("from", e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary whitespace-nowrap">إلى:</label>
          <Input type="date" defaultValue={to} className="w-36" onChange={(e) => updateParam("to", e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الكود</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">العميل</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">المندوب</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الإجمالي</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={ShoppingCart}
                      title="لا توجد طلبات مبيعات"
                      description="أنشئ أول طلب مبيعات لتسجيل المبيعات الميدانية"
                      cta={{ label: "إنشاء طلب", href: "/ar/sales/new" }}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{row.code}</td>
                    <td className="px-4 py-3">
                      <Link href={`/ar/customers/${row.customerId}`} className="font-medium text-brand-700 hover:underline">
                        {row.customerNameAr}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{row.repName ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold num">{formatSAR(row.total)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT_MAP[row.status] ?? "default"}>
                        {ORDER_STATUS_LABELS[row.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs num">
                      {format(new Date(row.createdAt), "dd/MM/yyyy", { locale: ar })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/ar/sales/${row.id}`}>
                        <Button size="icon" variant="ghost" title="تفاصيل">
                          <Eye size={15} />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-text-secondary">
              صفحة <span className="num">{page}</span> من <span className="num">{pageCount}</span>
              {" — "}إجمالي <span className="num">{total}</span> طلب
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>السابق</Button>
              <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => updateParam("page", String(page + 1))}>التالي</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
