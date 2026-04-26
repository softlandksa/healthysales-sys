import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getTasksReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { StatCard } from "@/components/kpi/stat-card";
import { formatNumber, cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/types";
import { ClipboardList, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "تقرير المهام" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

const TASK_STATUS_OPTIONS = (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((k) => ({
  value: k,
  label: TASK_STATUS_LABELS[k],
}));

const STATUS_BADGE: Record<string, string> = {
  pending:     "bg-neutral-100 text-neutral-600 border-neutral-200",
  in_progress: "bg-brand-50 text-brand-700 border-brand-200",
  done:        "bg-success-50 text-success-700 border-success-200",
  blocked:     "bg-warning-50 text-warning-700 border-warning-200",
  cancelled:   "bg-danger-50 text-danger-700 border-danger-200",
};

const STATUS_CARD: Record<string, string> = {
  pending:     "bg-neutral-100 text-neutral-700 border-neutral-200",
  in_progress: "bg-brand-50 text-brand-700 border-brand-200",
  done:        "bg-success-50 text-success-700 border-success-200",
  blocked:     "bg-warning-50 text-warning-700 border-warning-200",
  cancelled:   "bg-danger-50 text-danger-700 border-danger-200",
};

export default async function TasksReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from         = parseDate(sp.from, periodStart);
  const to           = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);
  const statusFilter = sp.status || undefined;

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(statusFilter               ? { status: statusFilter }     : {}),
    ...(user.role === "sales_rep"  ? { assignedToId: user.id }    : {}),
  };

  const data = await getTasksReport({ from, to, ...(statusFilter ? { status: statusFilter } : {}) }).catch(() => null);

  const statusKeys: TaskStatus[] = ["pending", "in_progress", "done", "blocked", "cancelled"];

  return (
    <ReportShell
      title="تقرير المهام"
      description="المهام المسندة: الحالات، التأخير، توزيع الأعباء"
      type="tasks"
      exportParams={exportParams}
    >
      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-end gap-4 print:hidden">
        <DateRangeFilter
          extraFilters={
            <SelectFilter
              paramKey="status"
              label="الحالة"
              options={TASK_STATUS_OPTIONS}
              {...(statusFilter ? { currentValue: statusFilter } : {})}
            />
          }
        />
      </div>

      {!data ? (
        <div className="card p-12 text-center text-text-secondary">
          <ClipboardList size={40} className="mx-auto mb-3 text-text-muted" />
          <p className="font-medium">لا توجد بيانات لهذه الفترة</p>
          <p className="text-sm mt-1">جرب تغيير نطاق التاريخ أو المرشحات</p>
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="إجمالي المهام"   value={formatNumber(data.summary.total)}
              icon={ClipboardList} iconColor="text-violet-600" iconBg="bg-violet-50" />
            <StatCard label="منجزة"           value={formatNumber(data.summary.done)}
              icon={ClipboardList} iconColor="text-success-600" iconBg="bg-success-50" />
            <StatCard label="قيد التنفيذ"    value={formatNumber(data.summary.inProgress)}
              icon={ClipboardList} iconColor="text-blue-600"    iconBg="bg-blue-50" />
            <StatCard label="متأخرة"          value={formatNumber(data.summary.overdue)}
              icon={AlertTriangle} iconColor="text-danger-600"  iconBg="bg-danger-50" />
          </div>

          {/* Status breakdown cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {statusKeys.map((s) => {
              const count = s === "pending"     ? data.summary.pending
                          : s === "in_progress" ? data.summary.inProgress
                          : s === "done"        ? data.summary.done
                          : s === "blocked"     ? data.summary.blocked
                          :                       data.summary.cancelled;
              return (
                <div key={s} className={cn("card p-4 border", STATUS_CARD[s])}>
                  <p className="text-xs font-semibold">{TASK_STATUS_LABELS[s]}</p>
                  <p className="text-2xl font-bold num mt-1">{formatNumber(count)}</p>
                </div>
              );
            })}
          </div>

          {/* By Assignee */}
          {data.byAssignee.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">توزيع المهام حسب المنفِّذ</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-1 border-b border-border">
                    <tr>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المنفِّذ</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الإجمالي</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">جديدة</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">قيد التنفيذ</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">منجزة</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">معلقة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.byAssignee.map((a) => (
                      <tr key={a.userId} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-text-primary">{a.userName ?? a.userId}</td>
                        <td className="py-2.5 px-4 num font-semibold text-violet-700">{formatNumber(a.total)}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">{formatNumber(a.pending)}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">{formatNumber(a.inProgress)}</td>
                        <td className="py-2.5 px-4 num text-success-700 font-medium">{formatNumber(a.done)}</td>
                        <td className="py-2.5 px-4 num text-warning-700">{formatNumber(a.blocked)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tasks table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">تفاصيل المهام</h3>
              <span className="text-xs text-text-muted num">{data.tasks.length} مهمة</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المهمة</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المسند إليه</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المُسنِد</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">تاريخ الاستحقاق</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.tasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-text-secondary">
                        لا توجد مهام في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    data.tasks.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-text-primary max-w-xs truncate">{t.title}</td>
                        <td className="py-2.5 px-4 text-text-secondary">{t.assignedTo ?? "—"}</td>
                        <td className="py-2.5 px-4 text-text-secondary">{t.assignedBy ?? "—"}</td>
                        <td className="py-2.5 px-4">
                          <span className={cn(
                            "inline-flex text-xs px-2.5 py-0.5 rounded-badge font-medium border",
                            STATUS_BADGE[t.status] ?? STATUS_BADGE.pending
                          )}>
                            {TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status}
                          </span>
                        </td>
                        <td className={cn(
                          "py-2.5 px-4 num text-xs whitespace-nowrap",
                          t.isOverdue ? "text-danger-600 font-semibold" : "text-text-secondary"
                        )}>
                          {t.dueDate.toLocaleDateString("ar-SA")}
                          {t.isOverdue && <span className="block text-danger-500 text-xs">متأخرة</span>}
                        </td>
                        <td className="py-2.5 px-4 num text-xs text-text-secondary whitespace-nowrap">
                          {t.createdAt.toLocaleDateString("ar-SA")}
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
