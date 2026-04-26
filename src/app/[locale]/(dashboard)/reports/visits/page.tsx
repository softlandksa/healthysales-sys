import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ReportShell } from "@/components/reports/ReportShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { SelectFilter } from "@/components/reports/SelectFilter";
import { formatNumber } from "@/lib/utils";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { MapPin, Users, Calendar } from "lucide-react";
import { VISIT_TYPE_LABELS, type VisitType } from "@/types";

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

const TYPE_BADGE: Record<VisitType, string> = {
  visit_only: "bg-brand-50 text-brand-700 border-brand-200",
  sale:       "bg-success-50 text-success-700 border-success-200",
  collection: "bg-warning-50 text-warning-700 border-warning-200",
};

export default async function VisitsReportPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const user = await requireUser();
  const now  = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from        = parseDate(sp.from, periodStart);
  const to          = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const typeFilter = (sp.visitType as VisitType) || undefined;
  const isRep      = user.role === "sales_rep";
  const repScope   = isRep ? { repId: user.id } : {};

  const exportParams: Record<string, string> = {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    ...(typeFilter ? { visitType: typeFilter } : {}),
    ...(isRep ? { repId: user.id } : {}),
  };

  const [visitsR, uniqueCustomersR] = await Promise.allSettled([
    prisma.visit.findMany({
      where: {
        ...repScope,
        visitedAt: { gte: from, lte: to },
        ...(typeFilter ? { visitType: typeFilter } : {}),
      },
      include: {
        customer: { select: { nameAr: true, code: true } },
        rep:      { select: { name: true } },
      },
      orderBy: { visitedAt: "desc" },
      take: 500,
    }),
    prisma.visit.groupBy({
      by:    ["customerId"],
      where: { ...repScope, visitedAt: { gte: from, lte: to } },
    }),
  ] as const);

  const visits          = visitsR.status          === "fulfilled" ? visitsR.value          : [];
  const uniqueCustomers = uniqueCustomersR.status === "fulfilled" ? uniqueCustomersR.value.length : 0;

  const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
  const avgPerDay = visits.length / totalDays;

  return (
    <ReportShell title="تقرير الزيارات" description="زيارات المندوبين خلال الفترة المحددة" type="visits" exportParams={exportParams}>
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

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-warning-50 w-fit">
            <MapPin size={18} className="text-warning-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(visits.length)}</p>
            <p className="text-sm text-text-secondary mt-0.5">إجمالي الزيارات</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-brand-50 w-fit">
            <Users size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(uniqueCustomers)}</p>
            <p className="text-sm text-text-secondary mt-0.5">عملاء مختلفون</p>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-card bg-success-50 w-fit">
            <Calendar size={18} className="text-success-600" />
          </div>
          <div>
            <p className="text-2xl font-bold num text-text-primary">{avgPerDay.toFixed(1)}</p>
            <p className="text-sm text-text-secondary mt-0.5">متوسط يومي</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-primary text-sm">تفاصيل الزيارات</h3>
          <span className="text-xs text-text-muted num">{visits.length} زيارة</span>
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
              {visits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-text-secondary">
                    لا توجد زيارات في هذه الفترة
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-1 transition-colors">
                    <td className="py-2.5 px-4 num text-xs text-text-secondary whitespace-nowrap">
                      {v.visitedAt.toLocaleDateString("ar-SA")}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-text-primary">{v.customer.nameAr}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{v.rep.name ?? "—"}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex text-xs px-2.5 py-0.5 rounded-badge font-medium border ${TYPE_BADGE[v.visitType as VisitType]}`}>
                        {VISIT_TYPE_LABELS[v.visitType as VisitType]}
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
    </ReportShell>
  );
}
