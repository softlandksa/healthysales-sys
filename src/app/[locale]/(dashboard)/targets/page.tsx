import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listTargets } from "@/server/actions/targets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TARGET_METRIC_LABELS, TARGET_PERIOD_LABELS, type TargetPeriod, type TargetMetric } from "@/types";
import { formatSAR, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "الأهداف",
};

interface TargetsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

const METRIC_IS_AMOUNT: Record<TargetMetric, boolean> = {
  sales_amount:       true,
  collections_amount: true,
  visits_count:       false,
};

export default async function TargetsPage({ searchParams }: TargetsPageProps) {
  const user   = await requireUser();
  const sp     = await searchParams;
  const page   = Math.max(1, Number(sp.page ?? 1));

  const { targets, total } = await listTargets({ page, pageSize: 25 });
  const pageCount = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">الأهداف</h1>
          <p className="text-sm text-text-secondary mt-0.5">إجمالي: <span className="num">{total}</span></p>
        </div>
        {["admin", "general_manager", "sales_manager", "team_manager"].includes(user.role) && (
          <Link href="/ar/targets/new">
            <Button size="sm">
              <Plus size={16} />
              هدف جديد
            </Button>
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-border">
              <tr>
                <th className="text-right py-3 px-4 font-medium text-text-secondary">المندوب</th>
                <th className="text-right py-3 px-4 font-medium text-text-secondary">المقياس</th>
                <th className="text-right py-3 px-4 font-medium text-text-secondary">الفترة</th>
                <th className="text-right py-3 px-4 font-medium text-text-secondary">الهدف</th>
                <th className="text-right py-3 px-4 font-medium text-text-secondary">أُنشئ بواسطة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {targets.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-text-secondary">
                    لا توجد أهداف
                  </td>
                </tr>
              )}
              {targets.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-text-primary">{t.userName ?? "—"}</td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary">{TARGET_METRIC_LABELS[t.metric]}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{TARGET_PERIOD_LABELS[t.period]}</Badge>
                    <span className="ms-2 text-xs text-text-secondary num">
                      {t.periodStart.toLocaleDateString("ar-SA", { month: "short", year: "numeric" })}
                    </span>
                  </td>
                  <td className="py-3 px-4 num font-medium text-text-primary">
                    {METRIC_IS_AMOUNT[t.metric]
                      ? formatSAR(parseFloat(t.value))
                      : formatNumber(parseFloat(t.value))}
                  </td>
                  <td className="py-3 px-4 text-text-secondary">{t.createdByName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-text-secondary num">
              صفحة {page} من {pageCount}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?page=${page - 1}`}>
                  <Button variant="outline" size="sm">السابق</Button>
                </Link>
              )}
              {page < pageCount && (
                <Link href={`?page=${page + 1}`}>
                  <Button variant="outline" size="sm">التالي</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
