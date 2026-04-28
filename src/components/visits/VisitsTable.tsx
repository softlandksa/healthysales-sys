"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { VISIT_TYPE_LABELS } from "@/types";
import type { VisitRow } from "@/types";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface VisitsTableProps {
  rows: VisitRow[];
  total: number;
  page: number;
  pageSize: number;
  from: string;
  to: string;
  visitType: string;
}

const TYPE_BADGE: Record<string, "default" | "success" | "warning"> = {
  visit_only: "default",
  sale: "warning",
  collection: "success",
};

export function VisitsTable({ rows, total, page, pageSize, from, to, visitType }: VisitsTableProps) {
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
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary whitespace-nowrap">من:</label>
          <DatePicker
            value={from}
            onChange={(v) => updateParam("from", v)}
            className="w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary whitespace-nowrap">إلى:</label>
          <DatePicker
            value={to}
            onChange={(v) => updateParam("to", v)}
            className="w-44"
          />
        </div>
        <select
          className="h-9 rounded-input border border-border bg-surface-0 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={visitType}
          onChange={(e) => updateParam("visitType", e.target.value)}
        >
          <option value="">كل الأنواع</option>
          <option value="visit_only">زيارة</option>
          <option value="sale">بيع</option>
          <option value="collection">تحصيل</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const p = new URLSearchParams();
            router.push(`${pathname}?${p.toString()}`);
          }}
        >
          إعادة تعيين
        </Button>
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
                <th className="text-right px-4 py-3 font-medium text-text-secondary">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">معاملة</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={MapPin}
                      title="لا توجد زيارات"
                      description="سجّل أول زيارة ميدانية لتتبع نشاط المندوبين"
                      cta={{ label: "تسجيل زيارة", href: "/ar/visits/new" }}
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
                    <td className="px-4 py-3">
                      <Badge variant={TYPE_BADGE[row.visitType] ?? "default"}>
                        {VISIT_TYPE_LABELS[row.visitType]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs num">
                      {format(new Date(row.visitedAt), "dd/MM/yyyy HH:mm", { locale: ar })}
                    </td>
                    <td className="px-4 py-3">
                      {row.hasSale && <Badge variant="warning" className="text-xs">طلب</Badge>}
                      {row.hasCollection && <Badge variant="success" className="text-xs">تحصيل</Badge>}
                      {!row.hasSale && !row.hasCollection && <span className="text-text-muted text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/ar/visits/${row.id}`}>
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
              {" — "}إجمالي <span className="num">{total}</span> زيارة
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
