import { ShoppingCart, Wallet, MapPin, ClipboardList } from "lucide-react";
import { Prisma, type SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { formatSAR, formatNumber, cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

function dayBounds(now: Date, offsetDays: number) {
  const local = new Date(now.getTime() + RIYADH_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate() + offsetDays;
  const start = new Date(Date.UTC(y, m, d) - RIYADH_OFFSET_MS);
  const end   = new Date(Date.UTC(y, m, d + 1) - RIYADH_OFFSET_MS - 1);
  return { start, end };
}

interface MetricSlot { label: string; value: string }

function SectionCard({
  icon: Icon, iconBg, iconColor, title, slots,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  slots: [MetricSlot, MetricSlot, MetricSlot];
}) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn("p-2.5 rounded-card shrink-0", iconBg)}>
          <Icon size={20} className={iconColor} />
        </div>
        <h3 className="font-semibold text-text-primary text-base">{title}</h3>
      </div>
      <div className="grid grid-cols-3 border-t border-border pt-4">
        {slots.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "flex flex-col gap-1 px-3",
              i === 0 && "pr-0",
              i === 2 && "pl-0",
              i > 0 && "border-r border-border"
            )}
          >
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className="text-xl font-bold num text-text-primary leading-tight">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface DashboardSummaryProps {
  repIdFilter?: string[];
  taskAssigneeFilter?: string[];
}

export async function DashboardSummary({ repIdFilter, taskAssigneeFilter }: DashboardSummaryProps) {
  const now   = new Date();
  const today = dayBounds(now, 0);
  const yest  = dayBounds(now, -1);
  const month = currentMonthPeriod(now);

  const rs = repIdFilter !== undefined ? { repId: { in: repIdFilter } } : {};
  const ts = taskAssigneeFilter !== undefined ? { assignedToId: { in: taskAssigneeFilter } } : {};

  const NOT_CANCELLED: SalesOrderStatus[] = ["draft", "confirmed", "delivered", "collected"];

  const [
    sTodayR, sYestR, sMonthR,
    cTodayR, cYestR, cMonthR,
    vTodayR, vYestR, vMonthR,
    tPendR, tIpR, tDoneR,
  ] = await Promise.allSettled([
    prisma.salesOrder.aggregate({ where: { ...rs, status: { in: NOT_CANCELLED }, createdAt: { gte: today.start, lte: today.end } }, _sum: { total: true } }),
    prisma.salesOrder.aggregate({ where: { ...rs, status: { in: NOT_CANCELLED }, createdAt: { gte: yest.start,  lte: yest.end  } }, _sum: { total: true } }),
    prisma.salesOrder.aggregate({ where: { ...rs, status: { in: NOT_CANCELLED }, createdAt: { gte: month.periodStart, lte: month.periodEnd } }, _sum: { total: true } }),
    prisma.collection.aggregate({ where: { ...rs, isCancelled: false, collectedAt: { gte: today.start, lte: today.end } }, _sum: { amount: true } }),
    prisma.collection.aggregate({ where: { ...rs, isCancelled: false, collectedAt: { gte: yest.start,  lte: yest.end  } }, _sum: { amount: true } }),
    prisma.collection.aggregate({ where: { ...rs, isCancelled: false, collectedAt: { gte: month.periodStart, lte: month.periodEnd } }, _sum: { amount: true } }),
    prisma.visit.count({ where: { ...rs, visitedAt: { gte: today.start, lte: today.end } } }),
    prisma.visit.count({ where: { ...rs, visitedAt: { gte: yest.start,  lte: yest.end  } } }),
    prisma.visit.count({ where: { ...rs, visitedAt: { gte: month.periodStart, lte: month.periodEnd } } }),
    prisma.task.count({ where: { ...ts, status: "pending" } }),
    prisma.task.count({ where: { ...ts, status: "in_progress" } }),
    prisma.task.count({ where: { ...ts, status: "done" } }),
  ] as const);

  function agg(r: PromiseSettledResult<{ _sum: { total: Prisma.Decimal | null } }>): number {
    return r.status === "fulfilled" ? Number(r.value._sum.total ?? 0) : 0;
  }
  function aggA(r: PromiseSettledResult<{ _sum: { amount: Prisma.Decimal | null } }>): number {
    return r.status === "fulfilled" ? Number(r.value._sum.amount ?? 0) : 0;
  }
  function cnt(r: PromiseSettledResult<number>): number {
    return r.status === "fulfilled" ? r.value : 0;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SectionCard
        icon={ShoppingCart}
        iconBg="bg-brand-50"
        iconColor="text-brand-600"
        title="المبيعات"
        slots={[
          { label: "اليوم",     value: formatSAR(agg(sTodayR)) },
          { label: "أمس",       value: formatSAR(agg(sYestR))  },
          { label: "هذا الشهر", value: formatSAR(agg(sMonthR)) },
        ]}
      />
      <SectionCard
        icon={Wallet}
        iconBg="bg-success-50"
        iconColor="text-success-600"
        title="التحصيلات"
        slots={[
          { label: "اليوم",     value: formatSAR(aggA(cTodayR)) },
          { label: "أمس",       value: formatSAR(aggA(cYestR))  },
          { label: "هذا الشهر", value: formatSAR(aggA(cMonthR)) },
        ]}
      />
      <SectionCard
        icon={MapPin}
        iconBg="bg-warning-50"
        iconColor="text-warning-600"
        title="الزيارات"
        slots={[
          { label: "اليوم",     value: formatNumber(cnt(vTodayR)) },
          { label: "أمس",       value: formatNumber(cnt(vYestR))  },
          { label: "هذا الشهر", value: formatNumber(cnt(vMonthR)) },
        ]}
      />
      <SectionCard
        icon={ClipboardList}
        iconBg="bg-purple-50"
        iconColor="text-chart-5"
        title="المهام"
        slots={[
          { label: "جديدة",       value: formatNumber(cnt(tPendR)) },
          { label: "قيد التنفيذ", value: formatNumber(cnt(tIpR))   },
          { label: "منجزة",       value: formatNumber(cnt(tDoneR)) },
        ]}
      />
    </div>
  );
}
