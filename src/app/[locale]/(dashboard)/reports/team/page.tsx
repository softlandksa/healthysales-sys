import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getTeamReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { formatSAR, formatNumber, cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { Users, ShoppingCart, Wallet, MapPin } from "lucide-react";

export const metadata: Metadata = { title: "تقرير الفرق" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d;
}

const TEAM_COLORS = [
  { bg: "#eff6ff", headerBg: "bg-blue-600",    iconBg: "bg-blue-100",    iconColor: "text-blue-600",    bar: "bg-blue-400"    },
  { bg: "#f0fdf4", headerBg: "bg-emerald-600", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", bar: "bg-emerald-400" },
  { bg: "#fffbeb", headerBg: "bg-amber-600",   iconBg: "bg-amber-100",   iconColor: "text-amber-600",   bar: "bg-amber-400"   },
  { bg: "#f5f3ff", headerBg: "bg-violet-600",  iconBg: "bg-violet-100",  iconColor: "text-violet-600",  bar: "bg-violet-400"  },
  { bg: "#fef2f2", headerBg: "bg-rose-600",    iconBg: "bg-rose-100",    iconColor: "text-rose-600",    bar: "bg-rose-400"    },
  { bg: "#ecfdf5", headerBg: "bg-teal-600",    iconBg: "bg-teal-100",    iconColor: "text-teal-600",    bar: "bg-teal-400"    },
];

export default async function TeamReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from = parseDate(sp.from, periodStart);
  const to   = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const teamId = sp.teamId ?? undefined;

  const data = await getTeamReport({ from, to, ...(teamId ? { teamId } : {}) })
    .catch((e) => { console.error("[team-report] fetch failed:", e); return null; });

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(teamId ? { teamId } : {}),
  };

  const totalSales = data?.teams.reduce((s, t) => s + t.sales, 0) ?? 0;

  return (
    <ReportShell title="تقرير الفرق" type="team" exportParams={exportParams}>
      {/* Filters */}
      <div className="print:hidden">
        <DateRangeFilter />
      </div>

      {!data || data.teams.length === 0 ? (
        <div className="card p-12 text-center text-text-secondary">
          <Users size={40} className="mx-auto mb-3 text-text-muted" />
          <p className="font-medium">لا توجد بيانات للفرق في هذه الفترة</p>
          <p className="text-sm mt-1">جرب تغيير نطاق التاريخ</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <Users size={16} className="mx-auto mb-1 text-blue-500" />
              <p className="text-xs text-text-secondary">عدد الفرق</p>
              <p className="text-xl font-bold num text-blue-700">{formatNumber(data.teams.length)}</p>
            </div>
            <div className="card p-4 text-center">
              <ShoppingCart size={16} className="mx-auto mb-1 text-emerald-500" />
              <p className="text-xs text-text-secondary">إجمالي المبيعات</p>
              <p className="text-xl font-bold num text-emerald-700">{formatSAR(totalSales)}</p>
            </div>
            <div className="card p-4 text-center">
              <Wallet size={16} className="mx-auto mb-1 text-amber-500" />
              <p className="text-xs text-text-secondary">إجمالي التحصيلات</p>
              <p className="text-xl font-bold num text-amber-700">{formatSAR(data.teams.reduce((s, t) => s + t.collections, 0))}</p>
            </div>
            <div className="card p-4 text-center">
              <MapPin size={16} className="mx-auto mb-1 text-violet-500" />
              <p className="text-xs text-text-secondary">إجمالي الزيارات</p>
              <p className="text-xl font-bold num text-violet-700">{formatNumber(data.teams.reduce((s, t) => s + t.visits, 0))}</p>
            </div>
          </div>

          {/* Team cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.teams.map((team, i) => {
              const color = TEAM_COLORS[i % TEAM_COLORS.length] ?? { bg: "#eff6ff", headerBg: "bg-blue-600", iconBg: "bg-blue-100", iconColor: "text-blue-600", bar: "bg-blue-400" };
              const teamReps = data.reps.filter((r) => r.teamId === team.teamId);
              const salesPct = totalSales > 0 ? (team.sales / totalSales) * 100 : 0;

              return (
                <div
                  key={team.teamId}
                  className="card overflow-hidden border border-border"
                  style={{ background: color.bg }}
                >
                  {/* Team header */}
                  <div className={cn("px-5 py-4 flex items-center justify-between", color.headerBg)}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                        <Users size={18} className="text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-base">{team.teamName}</p>
                        <p className="text-white/70 text-xs">{team.repCount} مندوب</p>
                      </div>
                    </div>
                    <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-semibold">
                      #{i + 1}
                    </span>
                  </div>

                  {/* Team stats */}
                  <div className="grid grid-cols-3 divide-x divide-border/50 px-0 py-4 border-b border-border/40">
                    <div className="text-center px-4">
                      <ShoppingCart size={14} className={cn("mx-auto mb-1", color.iconColor)} />
                      <p className="text-[11px] text-text-secondary">المبيعات</p>
                      <p className="text-sm font-bold num text-text-primary">{formatSAR(team.sales)}</p>
                    </div>
                    <div className="text-center px-4">
                      <Wallet size={14} className={cn("mx-auto mb-1", color.iconColor)} />
                      <p className="text-[11px] text-text-secondary">التحصيلات</p>
                      <p className="text-sm font-bold num text-text-primary">{formatSAR(team.collections)}</p>
                    </div>
                    <div className="text-center px-4">
                      <MapPin size={14} className={cn("mx-auto mb-1", color.iconColor)} />
                      <p className="text-[11px] text-text-secondary">الزيارات</p>
                      <p className="text-sm font-bold num text-text-primary">{formatNumber(team.visits)}</p>
                    </div>
                  </div>

                  {/* Sales share bar */}
                  {totalSales > 0 && (
                    <div className="px-5 pt-3 pb-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>حصة الفريق من المبيعات</span>
                        <span className="num font-semibold">{salesPct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", color.bar)}
                          style={{ width: `${Math.min(100, salesPct)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Reps list */}
                  {teamReps.length > 0 && (
                    <div className="px-5 pb-4 pt-3 border-t border-border/40 mt-2">
                      <p className="text-xs font-semibold text-text-secondary mb-2">المندوبون</p>
                      <div className="space-y-2">
                        {teamReps.map((rep) => (
                          <div key={rep.repId} className="flex items-center justify-between bg-white/60 rounded-button px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", color.iconBg, color.iconColor)}>
                                {(rep.repName ?? rep.repId).slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium text-text-primary truncate">{rep.repName ?? rep.repId}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs num text-text-secondary">{formatSAR(rep.sales)}</span>
                              <span className="text-xs num text-text-muted">{formatNumber(rep.visits)} زيارة</span>
                            </div>
                          </div>
                        ))}
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
