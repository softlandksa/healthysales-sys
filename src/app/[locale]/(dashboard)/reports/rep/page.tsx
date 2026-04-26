import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getSalesReport } from "@/server/actions/reports";
import { getVisitsReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { formatSAR, formatNumber, cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { UserCircle, ShoppingCart, MapPin, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "تقرير المندوبين" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

function getInitials(name: string | null, fallback: string): string {
  if (!name) return fallback.slice(0, 2).toUpperCase();
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const CARD_COLORS = [
  { bg: "#eff6ff", iconBg: "bg-blue-100",    iconColor: "text-blue-600",    ring: "ring-blue-200"    },
  { bg: "#f0fdf4", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", ring: "ring-emerald-200" },
  { bg: "#fffbeb", iconBg: "bg-amber-100",   iconColor: "text-amber-600",   ring: "ring-amber-200"   },
  { bg: "#f5f3ff", iconBg: "bg-violet-100",  iconColor: "text-violet-600",  ring: "ring-violet-200"  },
  { bg: "#fef2f2", iconBg: "bg-rose-100",    iconColor: "text-rose-600",    ring: "ring-rose-200"    },
  { bg: "#ecfdf5", iconBg: "bg-teal-100",    iconColor: "text-teal-600",    ring: "ring-teal-200"    },
];

export default async function RepReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from = parseDate(sp.from, periodStart);
  const to   = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(user.role === "sales_rep" ? { repId: user.id } : {}),
  };

  const [salesR, visitsR] = await Promise.allSettled([
    getSalesReport({ from, to }).catch((e) => { console.error("[rep-report] sales fetch failed:", e); return null; }),
    getVisitsReport({ from, to }).catch((e) => { console.error("[rep-report] visits fetch failed:", e); return null; }),
  ]);

  const salesData  = salesR.status  === "fulfilled" ? salesR.value  : null;
  const visitsData = visitsR.status === "fulfilled" ? visitsR.value : null;

  // Merge per-rep data
  type RepRow = { repId: string; repName: string | null; sales: number; orders: number; visits: number };
  const repMap = new Map<string, RepRow>();

  for (const r of salesData?.byRep ?? []) {
    repMap.set(r.repId, { repId: r.repId, repName: r.repName, sales: r.amount, orders: r.orders, visits: 0 });
  }
  for (const r of visitsData?.byRep ?? []) {
    const cur = repMap.get(r.repId) ?? { repId: r.repId, repName: r.repName, sales: 0, orders: 0, visits: 0 };
    cur.visits = r.total;
    if (!cur.repName) cur.repName = r.repName;
    repMap.set(r.repId, cur);
  }

  const repRows = [...repMap.values()].sort((a, b) => b.sales - a.sales);

  const totalSales   = repRows.reduce((s, r) => s + r.sales, 0);
  const totalOrders  = repRows.reduce((s, r) => s + r.orders, 0);
  const totalVisits  = repRows.reduce((s, r) => s + r.visits, 0);

  return (
    <ReportShell
      title="تقرير المندوبين"
      description="أداء المندوبين: المبيعات، الزيارات، الطلبات"
      type="rep"
      exportParams={exportParams}
    >
      {/* Filters */}
      <div className="print:hidden">
        <DateRangeFilter />
      </div>

      {repRows.length === 0 ? (
        <div className="card p-12 text-center text-text-secondary">
          <UserCircle size={40} className="mx-auto mb-3 text-text-muted" />
          <p className="font-medium">لا توجد بيانات لهذه الفترة</p>
          <p className="text-sm mt-1">جرب تغيير نطاق التاريخ</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <ShoppingCart size={18} className="mx-auto mb-1 text-blue-500" />
              <p className="text-xs text-text-secondary">إجمالي المبيعات</p>
              <p className="text-lg font-bold num text-blue-700 mt-0.5">{formatSAR(totalSales)}</p>
            </div>
            <div className="card p-4 text-center">
              <TrendingUp size={18} className="mx-auto mb-1 text-emerald-500" />
              <p className="text-xs text-text-secondary">إجمالي الطلبات</p>
              <p className="text-lg font-bold num text-emerald-700 mt-0.5">{formatNumber(totalOrders)}</p>
            </div>
            <div className="card p-4 text-center">
              <MapPin size={18} className="mx-auto mb-1 text-amber-500" />
              <p className="text-xs text-text-secondary">إجمالي الزيارات</p>
              <p className="text-lg font-bold num text-amber-700 mt-0.5">{formatNumber(totalVisits)}</p>
            </div>
          </div>

          {/* Rep cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {repRows.map((rep, i) => {
              const color = CARD_COLORS[i % CARD_COLORS.length] ?? { bg: "#eff6ff", iconBg: "bg-blue-100", iconColor: "text-blue-600", ring: "ring-blue-200" };
              const initials = getInitials(rep.repName, rep.repId);
              const salesPct = totalSales > 0 ? (rep.sales / totalSales) * 100 : 0;
              return (
                <div
                  key={rep.repId}
                  className="card p-5 space-y-4 border border-border"
                  style={{ background: color.bg }}
                >
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ring-2",
                      color.iconBg, color.iconColor, color.ring
                    )}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-text-primary text-sm truncate">
                        {rep.repName ?? rep.repId}
                      </p>
                      <p className="text-xs text-text-muted">مندوب مبيعات</p>
                    </div>
                    {i < 3 && (
                      <span className={cn(
                        "mr-auto text-xs font-semibold px-2 py-0.5 rounded-full",
                        i === 0 ? "bg-amber-100 text-amber-700" :
                        i === 1 ? "bg-slate-100 text-slate-600" :
                                  "bg-orange-100 text-orange-700"
                      )}>
                        #{i + 1}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
                    <div className="text-center">
                      <ShoppingCart size={14} className={cn("mx-auto mb-1", color.iconColor)} />
                      <p className="text-[11px] text-text-secondary">المبيعات</p>
                      <p className="text-sm font-bold num text-text-primary">{formatSAR(rep.sales)}</p>
                    </div>
                    <div className="text-center border-r border-border/50">
                      <TrendingUp size={14} className={cn("mx-auto mb-1", color.iconColor)} />
                      <p className="text-[11px] text-text-secondary">الطلبات</p>
                      <p className="text-sm font-bold num text-text-primary">{formatNumber(rep.orders)}</p>
                    </div>
                    <div className="text-center border-r border-border/50">
                      <MapPin size={14} className={cn("mx-auto mb-1", color.iconColor)} />
                      <p className="text-[11px] text-text-secondary">الزيارات</p>
                      <p className="text-sm font-bold num text-text-primary">{formatNumber(rep.visits)}</p>
                    </div>
                  </div>

                  {/* Sales share bar */}
                  {totalSales > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>حصة المبيعات</span>
                        <span className="num font-semibold">{salesPct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", color.iconBg.replace("bg-", "bg-").replace("-100", "-400"))}
                          style={{ width: `${Math.min(100, salesPct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </ReportShell>
  );
}
