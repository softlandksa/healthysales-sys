import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getCompetitionsReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { Badge } from "@/components/ui/badge";
import { COMPETITION_STATUS_LABELS } from "@/types";
import { formatNumber } from "@/lib/utils";
import type { CompetitionStatus } from "@/types";

export const metadata: Metadata = { title: "تقرير المسابقات" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function CompetitionsReportPage({ searchParams }: Props) {
  const sp  = await searchParams;
  await requireUser();
  const now = new Date();

  const from = parseDate(sp.from, new Date(now.getFullYear() - 1, now.getMonth(), 1));
  const to   = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const status = sp.status as CompetitionStatus | undefined;
  const data   = await getCompetitionsReport({ from, to, ...(status ? { status } : {}) }).catch((e) => { console.error("[competitions-report] fetch failed:", e); return null; });

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(status ? { status } : {}),
  };

  return (
    <ReportShell title="تقرير المسابقات" type="competitions" exportParams={exportParams}>
      <DateRangeFilter />

      {!data ? (
        <p className="text-center text-text-secondary py-12">لا توجد بيانات</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-sm text-text-secondary">إجمالي المسابقات</p>
              <p className="text-2xl font-bold num mt-1">{data.summary.total}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">جارية</p>
              <p className="text-2xl font-bold num mt-1 text-warning-600">{data.summary.active}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">منتهية</p>
              <p className="text-2xl font-bold num mt-1 text-success-600">{data.summary.ended}</p>
            </div>
          </div>

          {/* Top winners */}
          {data.topWinners.length > 0 && (
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">الفائزون الأكثر تكراراً (المرتبة الأولى)</h3>
              <div className="divide-y divide-border">
                {data.topWinners.map((w, i) => (
                  <div key={w.userId} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{MEDAL[i] ?? `${i + 1}.`}</span>
                      <span className="text-sm font-medium text-text-primary">{w.name ?? w.userId}</span>
                    </div>
                    <span className="text-sm num text-text-secondary">{formatNumber(w.wins)} انتصار</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitions table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الاسم</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المنتج</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الحالة</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الفترة</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المشاركون</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الفائزون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.competitions.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 font-medium text-text-primary">{c.name}</td>
                      <td className="py-2.5 px-4 text-text-secondary">{c.productName}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline">{COMPETITION_STATUS_LABELS[c.status as CompetitionStatus]}</Badge>
                      </td>
                      <td className="py-2.5 px-4 num text-text-secondary text-xs">
                        {c.startDate.toLocaleDateString("ar-SA")} — {c.endDate.toLocaleDateString("ar-SA")}
                      </td>
                      <td className="py-2.5 px-4 num text-text-secondary">{c.participantCount}</td>
                      <td className="py-2.5 px-4 text-xs">
                        {c.winners.map((w) => (
                          <span key={w.rank} className="me-1">
                            {MEDAL[w.rank - 1]} {w.name ?? "—"}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </ReportShell>
  );
}
