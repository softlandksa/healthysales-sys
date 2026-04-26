import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { TASK_STATUS_LABELS } from "@/types";
import type { TaskStatus } from "@/types";

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

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending:     "bg-neutral-100 text-neutral-600 border-neutral-200",
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
  const statusFilter = (sp.status as TaskStatus) || undefined;
  const isRep        = user.role === "sales_rep";
  const assigneeScope = isRep ? { assignedToId: user.id } : {};

  const exportParams: Record<string, string> = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [tasksR, byStatusR] = await Promise.allSettled([
    prisma.task.findMany({
      where: {
        ...assigneeScope,
        createdAt: { gte: from, lte: to },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        assignedTo: { select: { name: true } },
        assignedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.task.groupBy({
      by:    ["status"],
      where: { ...assigneeScope, createdAt: { gte: from, lte: to } },
      _count: { id: true },
    }),
  ] as const);

  const tasks    = tasksR.status    === "fulfilled" ? tasksR.value    : [];
  const byStatus = byStatusR.status === "fulfilled" ? byStatusR.value : [];

  const getCount = (s: TaskStatus) => byStatus.find((g) => g.status === s)?._count.id ?? 0;

  return (
    <ReportShell title="تقرير المهام" description="المهام المسندة خلال الفترة المحددة" type="tasks" exportParams={exportParams}>
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

      {/* Summary by status */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
          <div key={s} className={cn("card p-4 border", STATUS_BADGE[s])}>
            <p className="text-xs font-semibold">{TASK_STATUS_LABELS[s]}</p>
            <p className="text-2xl font-bold num mt-1">{formatNumber(getCount(s))}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-primary text-sm">تفاصيل المهام</h3>
          <span className="text-xs text-text-muted num">{tasks.length} مهمة</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المهمة</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المسند إليه</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">تاريخ الاستحقاق</th>
                <th className="text-right py-2.5 px-4 font-medium text-text-secondary">تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-text-secondary">
                    لا توجد مهام في هذه الفترة
                  </td>
                </tr>
              ) : (
                tasks.map((t) => {
                  const isOverdue = t.dueDate < now && t.status !== "done" && t.status !== "cancelled";
                  return (
                    <tr key={t.id} className="hover:bg-surface-1 transition-colors">
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-text-primary">{t.title}</p>
                        {t.description && (
                          <p className="text-xs text-text-muted truncate max-w-xs">{t.description}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-text-secondary">{t.assignedTo?.name ?? "—"}</td>
                      <td className="py-2.5 px-4">
                        <span className={cn("inline-flex text-xs px-2.5 py-0.5 rounded-badge font-medium border", STATUS_BADGE[t.status as TaskStatus])}>
                          {TASK_STATUS_LABELS[t.status as TaskStatus]}
                        </span>
                      </td>
                      <td className={cn("py-2.5 px-4 num text-xs", isOverdue ? "text-danger-600 font-semibold" : "text-text-secondary")}>
                        {t.dueDate.toLocaleDateString("ar-SA")}
                        {isOverdue && <span className="block text-danger-500">متأخرة</span>}
                      </td>
                      <td className="py-2.5 px-4 num text-xs text-text-secondary">
                        {t.createdAt.toLocaleDateString("ar-SA")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
