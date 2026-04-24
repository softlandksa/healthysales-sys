import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/db/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/button";
import { CollectionsTable } from "@/components/collections/CollectionsTable";
import type { CollectionRow, PaymentMethod } from "@/types";

export const metadata: Metadata = { title: "التحصيلات" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; method?: string; page?: string }>;
}

export default async function CollectionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { from = "", to = "", method = "", page = "1" } = await searchParams;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Collection")) redirect("/ar/dashboard");

  const canCreate = ability.can("create", "Collection");
  const accessibleIds = await getAccessibleUserIds(currentUser);

  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = 20;

  const where = {
    repId: { in: accessibleIds },
    ...(method ? { method: method as PaymentMethod } : {}),
    ...(from || to ? { collectedAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
    }} : {}),
  };

  const [collections, total] = await Promise.all([
    prisma.collection.findMany({
      where,
      orderBy: { collectedAt: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, code: true, amount: true, method: true, isCancelled: true, collectedAt: true,
        rep: { select: { name: true, id: true } },
        customer: { select: { nameAr: true, id: true } },
      },
    }),
    prisma.collection.count({ where }),
  ]);

  const rows: CollectionRow[] = collections.map((c) => ({
    id: c.id,
    code: c.code,
    customerNameAr: c.customer.nameAr,
    customerId: c.customer.id,
    repName: c.rep.name,
    repId: c.rep.id,
    amount: c.amount.toFixed(2),
    method: c.method as PaymentMethod,
    isCancelled: c.isCancelled,
    collectedAt: c.collectedAt,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "الرئيسية", href: "/ar/dashboard" }, { label: "التحصيلات" }]} />
          <h1 className="text-2xl font-bold text-text-primary mt-2">التحصيلات</h1>
          <p className="text-sm text-text-secondary mt-0.5">إجمالي <span className="num">{total}</span> تحصيل</p>
        </div>
        {canCreate && (
          <Link href="/ar/collections/new">
            <Button><Plus size={16} />تحصيل جديد</Button>
          </Link>
        )}
      </div>

      <CollectionsTable
        rows={rows}
        total={total}
        page={pageNum}
        pageSize={pageSize}
        from={from}
        to={to}
        method={method}
      />
    </div>
  );
}
