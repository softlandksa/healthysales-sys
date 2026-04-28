"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import type { AuditLogRow, AuditLogTableFilters } from "@/server/actions/audit";

const ACTION_LABELS: Record<string, string> = {
  create:     "إنشاء",
  update:     "تعديل",
  delete:     "حذف",
  upsert:     "تحديث/إنشاء",
  createMany: "إنشاء متعدد",
  updateMany: "تعديل متعدد",
  deleteMany: "حذف متعدد",
};

const ACTION_COLORS: Record<string, string> = {
  create:     "text-success-700 bg-success-50",
  update:     "text-brand-700 bg-brand-50",
  delete:     "text-danger-700 bg-danger-50",
  upsert:     "text-brand-700 bg-brand-50",
  createMany: "text-success-700 bg-success-50",
  updateMany: "text-brand-700 bg-brand-50",
  deleteMany: "text-danger-700 bg-danger-50",
};

interface Props {
  rows:           AuditLogRow[];
  entityTypes:    string[];
  nextCursor:     string | null;
  initialFilters: AuditLogTableFilters;
}

function DiffDrawer({ row, onClose }: { row: AuditLogRow; onClose: () => void }) {
  const meta = row.metadata as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
  const before = meta?.before ?? {};
  const after  = meta?.after  ?? {};

  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changed = allKeys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const unchanged = allKeys.filter((k) => !changed.includes(k));

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-surface-0 border-r border-border h-full overflow-y-auto shadow-modal">
        <div className="sticky top-0 bg-surface-0 border-b border-border px-5 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-text-primary text-sm">
              {ACTION_LABELS[row.action] ?? row.action} — {row.entityType}
            </p>
            <p className="text-xs text-text-muted num">{row.entityId}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {changed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">التغييرات</p>
              <div className="space-y-1">
                {changed.map((key) => (
                  <div key={key} className="text-xs rounded-card overflow-hidden border border-border">
                    <div className="px-3 py-1 bg-neutral-50 font-medium text-text-secondary">{key}</div>
                    {before[key] !== undefined && (
                      <div className="px-3 py-1.5 bg-danger-50 text-danger-700 font-mono break-all">
                        − {JSON.stringify(before[key])}
                      </div>
                    )}
                    {after[key] !== undefined && (
                      <div className="px-3 py-1.5 bg-success-50 text-success-700 font-mono break-all">
                        + {JSON.stringify(after[key])}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {unchanged.length > 0 && (
            <details className="group">
              <summary className="text-xs font-semibold text-text-muted cursor-pointer list-none flex items-center gap-1">
                <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                حقول بدون تغيير ({unchanged.length})
              </summary>
              <div className="mt-2 space-y-1">
                {unchanged.map((key) => (
                  <div key={key} className="text-xs flex gap-2 px-3 py-1.5 bg-neutral-50 rounded">
                    <span className="font-medium text-text-secondary min-w-[120px]">{key}</span>
                    <span className="font-mono text-text-muted break-all">{JSON.stringify(after[key] ?? before[key])}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Meta */}
          <div className="text-xs text-text-muted space-y-1 pt-2 border-t border-border">
            {row.userId   && <p>المستخدم: {row.userName ?? row.userId}</p>}
            {row.ipAddress && <p>IP: {row.ipAddress}</p>}
            <p>{new Date(row.createdAt).toLocaleString("ar-SA")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuditLogTable({ rows, entityTypes, nextCursor, initialFilters }: Props) {
  const router    = useRouter();
  const pathname  = usePathname();
  const sp        = useSearchParams();
  const [, start] = useTransition();
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("cursor");
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  const fromStr = initialFilters.from?.toISOString().slice(0, 10) ?? "";
  const toStr   = initialFilters.to?.toISOString().slice(0, 10)   ?? "";

  return (
    <>
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">من</label>
            <DatePicker
              defaultValue={fromStr}
              onChange={(v) => applyFilter("from", v)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">إلى</label>
            <DatePicker
              defaultValue={toStr}
              onChange={(v) => applyFilter("to", v)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">نوع الكيان</label>
            <select
              defaultValue={initialFilters.entityType ?? ""}
              onChange={(e) => applyFilter("entityType", e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="">الكل</option>
              {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">الإجراء</label>
            <select
              defaultValue={initialFilters.action ?? ""}
              onChange={(e) => applyFilter("action", e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="">الكل</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-center py-12 text-text-muted text-sm">لا توجد سجلات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-border">
                <tr>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الإجراء</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الكيان</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المعرف</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المستخدم</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الوقت</th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => setSelected(row)}>
                    <td className="py-2.5 px-4">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", ACTION_COLORS[row.action] ?? "text-text-secondary bg-neutral-100")}>
                        {ACTION_LABELS[row.action] ?? row.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-text-primary font-medium">{row.entityType}</td>
                    <td className="py-2.5 px-4 text-text-muted font-mono text-xs num">{row.entityId?.slice(-8) ?? "—"}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{row.userName ?? row.userId ?? "النظام"}</td>
                    <td className="py-2.5 px-4 text-text-muted text-xs" title={new Date(row.createdAt).toLocaleString("ar-SA")}>
                      {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: ar })}
                    </td>
                    <td className="py-2.5 px-4">
                      <ExternalLink size={14} className="text-text-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {nextCursor && (
          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={() => applyFilter("cursor", nextCursor)}
              className="text-sm text-brand-600 hover:underline"
            >
              تحميل المزيد
            </button>
          </div>
        )}
      </div>

      {/* Diff drawer */}
      {selected && <DiffDrawer row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
