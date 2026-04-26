import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getVisitsReport } from "@/server/actions/reports";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { StatCard } from "@/components/kpi/stat-card";
import { formatNumber, cn } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { VISIT_TYPE_LABELS, type VisitType } from "@/types";
import { MapPin, Users, Calendar } from "lucide-react";

export const metadata: Metadata = { title: "تقرير الزيارات" };
interface Props { searchParams: Promise<Record<string, string>> }

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

const VISIT_TYPE_OPTIONS = (Object.keys(VISIT_TYPE_LABELS) as VisitType[]).map((k) => ({
  value: k,
  label: VISIT_TYPE_LABELS[k],
}));

const TYPE_BADGE: Record<string, string> = {
  visit_only: "bg-brand-50 text-brand-700 border-brand-200",
  sale:       "bg-success-50 text-success-700 border-success-200",
  collection: "bg-warning-50 text-warning-700 border-warning-200",
};

const TYPE_CARD: Record<string, string> = {
  visit_only: "bg-brand-50 text-brand-700 border-brand-200",
  sale:       "bg-success-50 text-success-700 border-success-200",
  collection: "bg-warning-50 text-warning-700 border-warning-200",
};

export default async function VisitsReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from       = parseDate(sp.from, periodStart);
  const to         = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);
  const typeFilter = sp.visitType || undefined;

  const exportParams = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(typeFilter               ? { visitType: typeFilter } : {}),
    ...(user.role === "sales_rep" ? { repId: user.id }       : {}),
  };

  const data = await getVisitsReport({ from, to, ...(typeFilter ? { visitType: typeFilter } : {}) }).catch(() => null);

  return (
    <ReportShell
      title="تقرير الزيارات"
      description="زيارات المندوبين: العملاء، الأنواع، المتوسط اليومي"
      type="visits"
      exportParams={exportParams}
    >
      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-end gap-4 print:hidden">
        <DateRangeFilter
          extraFilters={
            <SelectFilter
              paramKey="visitType"
              label="نوع الزيارة"
              options={VISIT_TYPE_OPTIONS}
              {...(typeFilter ? { currentValue: typeFilter } : {})}
            />
          }
        />
      </div>

      {!data ? (
        <div className="card p-12 text-center text-text-secondary">
          <MapPin size={40} className="mx-auto mb-3 text-text-muted" />
          <p className="font-medium">لا توجد بيانات لهذه الفترة</p>
          <p className="text-sm mt-1">جرب تغيير نطاق التاريخ أو المرشحات</p>
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="إجمالي الزيارات"    value={formatNumber(data.summary.total)}
              icon={MapPin}    iconColor="text-amber-600"   iconBg="bg-amber-50" />
            <StatCard label="عملاء مختلفون"       value={formatNumber(data.summary.uniqueCustomers)}
              icon={Users}     iconColor="text-blue-600"    iconBg="bg-blue-50" />
            <StatCard label="متوسط يومي"          value={data.summary.avgPerDay.toFixed(1)}
              icon={Calendar}  iconColor="text-emerald-600" iconBg="bg-emerald-50" />
          </div>

          {/* Type breakdown cards */}
          <div className="grid grid-cols-3 gap-3">
            {(["visit_only", "sale", "collection"] as VisitType[]).map((t) => {
              const count = t === "visit_only" ? data.summary.visitOnly
                          : t === "sale"       ? data.summary.sale
                          :                     data.summary.collection;
              return (
                <div key={t} className={cn("card p-4 border", TYPE_CARD[t])}>
                  <p className="text-xs font-semibold">{VISIT_TYPE_LABELS[t]}</p>
                  <p className="text-2xl font-bold num mt-1">{formatNumber(count)}</p>
                </div>
              );
            })}
          </div>

          {/* By Rep */}
          {data.byRep.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">الزيارات حسب المندوب</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-1 border-b border-border">
                    <tr>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">#</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">الإجمالي</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">زيارة</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">بيع</th>
                      <th className="text-right py-2.5 px-4 font-medium text-text-secondary">تحصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.byRep.map((r, i) => (
                      <tr key={r.repId} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 num text-text-secondary">{i + 1}</td>
                        <td className="py-2.5 px-4 font-medium text-text-primary">{r.repName ?? r.repId}</td>
                        <td className="py-2.5 px-4 num font-semibold text-amber-700">{formatNumber(r.total)}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">{formatNumber(r.visitOnly)}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">{formatNumber(r.sale)}</td>
                        <td className="py-2.5 px-4 num text-text-secondary">{formatNumber(r.collection)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Visits table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">تفاصيل الزيارات</h3>
              <span className="text-xs text-text-muted num">{data.visits.length} زيارة</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">التاريخ</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">العميل</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">المندوب</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">النوع</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.visits.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-text-secondary">
                        لا توجد زيارات في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    data.visits.map((v) => (
                      <tr key={v.id} className="hover:bg-surface-1 transition-colors">
                        <td className="py-2.5 px-4 num text-xs text-text-secondary whitespace-nowrap">
                          {v.visitedAt.toLocaleDateString("ar-SA")}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-text-primary">{v.customerName}</td>
                        <td className="py-2.5 px-4 text-text-secondary">{v.repName ?? "—"}</td>
                        <td className="py-2.5 px-4">
                          <span className={cn(
                            "inline-flex text-xs px-2.5 py-0.5 rounded-badge font-medium border",
                            TYPE_BADGE[v.visitType] ?? TYPE_BADGE.visit_only
                          )}>
                            {VISIT_TYPE_LABELS[v.visitType as VisitType] ?? v.visitType}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-text-secondary text-xs max-w-xs truncate">
                          {v.notes ?? "—"}
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
