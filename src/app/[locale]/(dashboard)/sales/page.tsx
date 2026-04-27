import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/button";
import { SalesOrdersTable } from "@/components/sales/SalesOrdersTable";
import type { SalesOrderRow, SalesOrderStatus } from "@/types";

export const metadata: Metadata = { title: "طلبات البيع" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
}

export default async function SalesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { status = "", from = "", to = "", page = "1" } = await searchParams;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "SalesOrder")) redirect("/ar/dashboard");

  const canCreate = ability.can("create", "SalesOrder");
  const accessibleIds = await getAccessibleUserIds(currentUser);

  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = 20;

  const where = {
    repId: { in: accessibleIds },
    ...(status ? { status: status as SalesOrderStatus } : {}),
    ...(from || to ? { createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
    }} : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, code: true, status: true, total: true, createdAt: true, confirmedAt: true,
        rep: { select: { name: true, id: true } },
        customer: { select: { nameAr: true, id: true } },
        items: { select: { id: true } },
      },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  const rows: SalesOrderRow[] = orders.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status as SalesOrderStatus,
    customerNameAr: o.customer.nameAr,
    customerId: o.customer.id,
    repName: o.rep.name,
    repId: o.rep.id,
    total: o.total.toFixed(2),
    itemCount: o.items.length,
    confirmedAt: o.confirmedAt,
    createdAt: o.createdAt,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "الرئيسية", href: "/ar/dashboard" }, { label: "طلبات البيع" }]} />
          <h1 className="text-2xl font-bold text-text-primary mt-2">طلبات البيع</h1>
          <p className="text-sm text-text-secondary mt-0.5">إجمالي <span className="num">{total}</span> طلب</p>
        </div>
        {canCreate && (
          <Link href="/ar/sales/new">
            <Button><Plus size={16} />طلب جديد</Button>
          </Link>
        )}
      </div>

      <SalesOrdersTable
        rows={rows}
        total={total}
        page={pageNum}
        pageSize={pageSize}
        status={status}
        from={from}
        to={to}
      />
    </div>
  );
}
