"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, AlertCircle, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types";
import type { TaskRow, TaskStatus } from "@/types";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface TasksTableProps {
  rows: TaskRow[];
  total: number;
  page: number;
  pageSize: number;
  status: string;
  assignedToId: string;
  overdue: boolean;
  isManager: boolean;
}

const STATUS_OPTIONS: { value: TaskStatus | ""; label: string }[] = [
  { value: "",            label: "كل الحالات" },
  { value: "pending",     label: "معلّقة" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "blocked",     label: "محجوبة" },
  { value: "done",        label: "مكتملة" },
  { value: "cancelled",   label: "ملغاة" },
];

export function TasksTable({
  rows,
  total,
  page,
  pageSize,
  status,
  overdue,
  isManager,
}: TasksTableProps) {
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

  function toggleOverdue() {
    const p = new URLSearchParams(searchParams.toString());
    if (overdue) p.delete("overdue"); else p.set("overdue", "1");
    p.delete("page");
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

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overdue}
            onChange={toggleOverdue}
            className="rounded border-border"
          />
          متأخرة فقط
        </label>

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
                <th className="text-right px-4 py-3 font-medium text-text-secondary">العنوان</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الحالة</th>
                {isManager && (
                  <th className="text-right px-4 py-3 font-medium text-text-secondary">المُسنَد إليه</th>
                )}
                <th className="text-right px-4 py-3 font-medium text-text-secondary">المُسنِد</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الاستحقاق</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 6 : 5}>
                    <EmptyState
                      icon={CheckSquare}
                      title="لا توجد مهام"
                      description="أنشئ مهمة وكلّفها لأحد المندوبين لمتابعة تنفيذها"
                      cta={{ label: "إضافة مهمة", href: "/ar/tasks/new" }}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <Link href={`/ar/tasks/${row.id}`} className="font-medium text-brand-700 hover:underline line-clamp-2">
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={TASK_STATUS_COLORS[row.status]}>
                        {TASK_STATUS_LABELS[row.status]}
                      </Badge>
                    </td>
                    {isManager && (
                      <td className="px-4 py-3 text-text-secondary text-xs">
                        {row.assignedToName ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {row.assignedByName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs num ${row.isOverdue && row.status !== "done" && row.status !== "cancelled" ? "text-danger-600 font-medium" : "text-text-secondary"}`}>
                          {format(new Date(row.dueDate), "dd/MM/yyyy", { locale: ar })}
                        </span>
                        {row.isOverdue && row.status !== "done" && row.status !== "cancelled" && (
                          <AlertCircle size={13} className="text-danger-500 shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/ar/tasks/${row.id}`}>
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
              {" — "}إجمالي <span className="num">{total}</span> مهمة
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
