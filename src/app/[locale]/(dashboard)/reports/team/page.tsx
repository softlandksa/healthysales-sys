import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getTeamReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { BarChart } from "@/components/charts/bar-chart";
import { formatSAR, formatNumber } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";

export const metadata: Metadata = { title: "تقرير الفرق" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d;
}

export default async function TeamReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from = parseDate(sp.from, periodStart);
  const to   = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const teamId = sp.teamId ?? undefined;
  const data   = await getTeamReport({ from, to, ...(teamId ? { teamId } : {}) }).catch(() => null);

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(teamId ? { teamId } : {}),
  };

  const teamChartData = data?.teams.map((t) => ({
    team:        t.teamName,
    sales:       t.sales,
    collections: t.collections,
  })) ?? [];

  return (
    <ReportShell title="تقرير الفرق" type="team" exportParams={exportParams}>
      <DateRangeFilter />

      {!data || data.teams.length === 0 ? (
        <p className="text-center text-text-secondary py-12">لا توجد بيانات</p>
      ) : (
        <>
          {/* Team bar chart */}
          {teamChartData.length > 0 && (
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">مقارنة الفرق</h3>
              <BarChart
                data={teamChartData}
                xKey="team"
                series={[
                  { key: "sales",       label: "المبيعات",  color: "#2563eb" },
                  { key: "collections", label: "التحصيلات", color: "#16a34a" },
                ]}
                height={240}
                valueFormatter={(v) => formatSAR(v)}
              />
            </div>
          )}

          {/* Team summary table */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-border">
                <tr>
                  <th className="text-right py-3 px-4 font-medium text-text-secondary">الفريق</th>
                  <th className="text-right py-3 px-4 font-medium text-text-secondary">المبيعات</th>
                  <th className="text-right py-3 px-4 font-medium text-text-secondary">التحصيلات</th>
                  <th className="text-right py-3 px-4 font-medium text-text-secondary">الزيارات</th>
                  <th className="text-right py-3 px-4 font-medium text-text-secondary">المندوبون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.teams.map((t) => (
                  <tr key={t.teamId} className="hover:bg-neutral-50">
                    <td className="py-3 px-4 font-medium text-text-primary">{t.teamName}</td>
                    <td className="py-3 px-4 num text-text-secondary">{formatSAR(t.sales)}</td>
                    <td className="py-3 px-4 num text-text-secondary">{formatSAR(t.collections)}</td>
                    <td className="py-3 px-4 num text-text-secondary">{formatNumber(t.visits)}</td>
                    <td className="py-3 px-4 num text-text-secondary">{t.repCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rep comparison table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">أداء المندوبين</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-border">
                <tr>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الفريق</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المبيعات</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">التحصيلات</th>
                  <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الزيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.reps.map((r) => (
                  <tr key={r.repId} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-4 text-text-primary">{r.repName ?? r.repId}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{r.teamName}</td>
                    <td className="py-2.5 px-4 num text-text-secondary">{formatSAR(r.sales)}</td>
                    <td className="py-2.5 px-4 num text-text-secondary">{formatSAR(r.collections)}</td>
                    <td className="py-2.5 px-4 num text-text-secondary">{formatNumber(r.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ReportShell>
  );
}
