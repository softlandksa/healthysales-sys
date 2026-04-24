import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { listVisits } from "@/server/actions/visits";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/button";
import { VisitsTable } from "@/components/visits/VisitsTable";
import type { VisitRow } from "@/types";

export const metadata: Metadata = { title: "الزيارات" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    visitType?: string;
    page?: string;
  }>;
}

export default async function VisitsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { from = "", to = "", visitType = "", page = "1" } = await searchParams;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Visit")) redirect("/ar/dashboard");

  const canCreate = ability.can("create", "Visit");
  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = 20;

  const result = await listVisits({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(visitType ? { visitType } : {}),
    page: pageNum,
    pageSize,
  });

  const rows: VisitRow[] = result.visits.map((v) => ({
    id: v.id,
    code: v.code,
    visitType: v.visitType as import("@/types").VisitType,
    customerNameAr: v.customer.nameAr,
    customerId: v.customer.id,
    repName: v.rep.name,
    repId: v.rep.id,
    notes: v.notes,
    hasSale: v.salesOrder !== null,
    hasCollection: v.collection !== null,
    visitedAt: v.visitedAt,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "الرئيسية", href: "/ar/dashboard" }, { label: "الزيارات" }]} />
          <h1 className="text-2xl font-bold text-text-primary mt-2">الزيارات</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            إجمالي <span className="num">{result.total}</span> زيارة
          </p>
        </div>
        {canCreate && (
          <Link href="/ar/visits/new">
            <Button>
              <Plus size={16} />
              زيارة جديدة
            </Button>
          </Link>
        )}
      </div>

      <VisitsTable
        rows={rows}
        total={result.total}
        page={pageNum}
        pageSize={pageSize}
        from={from}
        to={to}
        visitType={visitType}
      />
    </div>
  );
}
