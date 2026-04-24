"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { COMPETITION_STATUS_LABELS, COMPETITION_STATUS_COLORS } from "@/types";
import type { CompetitionRow, CompetitionStatus } from "@/types";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface CompetitionsTableProps {
  rows: CompetitionRow[];
  total: number;
  page: number;
  pageSize: number;
  status: string;
}

const STATUS_OPTIONS: { value: CompetitionStatus | ""; label: string }[] = [
  { value: "",          label: "كل الحالات" },
  { value: "upcoming",  label: "قادمة" },
  { value: "active",    label: "جارية" },
  { value: "ended",     label: "منتهية" },
  { value: "cancelled", label: "ملغاة" },
];

export function CompetitionsTable({ rows, total, page, pageSize, status }: CompetitionsTableProps) {
  const router   = useRouter();
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
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(pathname)}
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
                <th className="text-right px-4 py-3 font-medium text-text-secondary">اسم المسابقة</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">المنتج</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الفترة</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الجائزة</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Trophy}
                      title="لا توجد مسابقات"
                      description="أنشئ مسابقة لتحفيز فريق المبيعات وتتبع الأداء"
                      cta={{ label: "إنشاء مسابقة", href: "/ar/competitions/new" }}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <Link href={`/ar/competitions/${row.id}`} className="font-medium text-brand-700 hover:underline">
                        {row.name}
                      </Link>
                      {row.createdByName && (
                        <p className="text-xs text-text-muted mt-0.5">{row.createdByName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={COMPETITION_STATUS_COLORS[row.status]}>
                        {COMPETITION_STATUS_LABELS[row.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-sm">
                      {row.productName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-text-secondary num space-y-0.5">
                        <div>{format(new Date(row.startDate), "dd/MM/yyyy", { locale: ar })}</div>
                        <div className="text-text-muted">← {format(new Date(row.endDate), "dd/MM/yyyy", { locale: ar })}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary max-w-xs truncate">
                      {row.prize}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/ar/competitions/${row.id}`}>
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
              {" — "}إجمالي <span className="num">{total}</span> مسابقة
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
