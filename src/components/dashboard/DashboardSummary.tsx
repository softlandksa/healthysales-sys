import { Fragment } from "react";
import { ShoppingCart, Wallet, MapPin, ClipboardList } from "lucide-react";
import { Prisma, type SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { formatSAR, formatNumber, cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

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

interface MetricSlot {
  label: string;
  value: string;
  badge: string;
}

function SectionCard({
  icon: Icon, iconBg, iconColor, title, slots, cardStyle,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  slots: [MetricSlot, MetricSlot, MetricSlot];
  cardStyle: CSSProperties;
}) {
  return (
    <div className="card p-5 overflow-hidden" style={cardStyle}>
      <div className="flex items-center gap-3 mb-5">
        <div className={cn("p-2.5 rounded-card shrink-0", iconBg)}>
          <Icon size={22} className={iconColor} />
        </div>
        <h3 className="font-bold text-text-primary text-base">{title}</h3>
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        {slots.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && (
              <div className="w-px h-12 bg-gray-300 shrink-0" />
            )}
            <div className="flex-1 flex flex-col items-center px-6 py-2 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-default">
              <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full leading-tight",
                s.badge
              )}>
                {s.label}
              </span>
              <p className="text-lg font-bold num text-text-primary mt-2 leading-tight">{s.value}</p>
            </div>
          </Fragment>
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
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        title="المبيعات"
        cardStyle={{ background: "#eff6ff" }}
        slots={[
          { label: "اليوم",     value: formatSAR(agg(sTodayR)), badge: "bg-blue-500 text-white"      },
          { label: "أمس",       value: formatSAR(agg(sYestR)),  badge: "bg-gray-200 text-gray-700"   },
          { label: "هذا الشهر", value: formatSAR(agg(sMonthR)), badge: "bg-gray-100 text-gray-500"   },
        ]}
      />
      <SectionCard
        icon={Wallet}
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
        title="التحصيلات"
        cardStyle={{ background: "#f0fdf4" }}
        slots={[
          { label: "اليوم",     value: formatSAR(aggA(cTodayR)), badge: "bg-blue-500 text-white"      },
          { label: "أمس",       value: formatSAR(aggA(cYestR)),  badge: "bg-gray-200 text-gray-700"   },
          { label: "هذا الشهر", value: formatSAR(aggA(cMonthR)), badge: "bg-gray-100 text-gray-500"   },
        ]}
      />
      <SectionCard
        icon={MapPin}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        title="الزيارات"
        cardStyle={{ background: "#fffbeb" }}
        slots={[
          { label: "اليوم",     value: formatNumber(cnt(vTodayR)), badge: "bg-blue-500 text-white"    },
          { label: "أمس",       value: formatNumber(cnt(vYestR)),  badge: "bg-gray-200 text-gray-700" },
          { label: "هذا الشهر", value: formatNumber(cnt(vMonthR)), badge: "bg-gray-100 text-gray-500" },
        ]}
      />
      <SectionCard
        icon={ClipboardList}
        iconBg="bg-violet-100"
        iconColor="text-violet-600"
        title="المهام"
        cardStyle={{ background: "#f5f3ff" }}
        slots={[
          { label: "جديدة",       value: formatNumber(cnt(tPendR)), badge: "bg-amber-100 text-amber-700"   },
          { label: "قيد التنفيذ", value: formatNumber(cnt(tIpR)),   badge: "bg-blue-100 text-blue-700"     },
          { label: "منجزة",       value: formatNumber(cnt(tDoneR)), badge: "bg-emerald-100 text-emerald-700" },
        ]}
      />
    </div>
  );
}
