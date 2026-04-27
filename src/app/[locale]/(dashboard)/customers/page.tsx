import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus, AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/button";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { CustomerExcelActions } from "@/components/customers/CustomerExcelActions";

export const metadata: Metadata = { title: "العملاء" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}

export default async function CustomersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q = "", page = "1", status = "" } = await searchParams;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Customer")) redirect("/ar/dashboard");

  const canCreate = ability.can("create", "Customer");
  const canEdit   = ability.can("update", "Customer");

  const pageSize = 20;
  const pageNum  = Math.max(1, parseInt(page, 10));

  let rows: {
    id: string; code: string; nameAr: string; nameEn: string | null;
    phone: string | null; balance: string; creditLimit: string | null;
    isActive: boolean; createdAt: Date;
    assignedToName: string | null; teamNameAr: string | null; regionNameAr: string | null;
  }[] = [];
  let total = 0;
  let pageError: string | null = null;

  try {
    const scopedFilter =
      currentUser.role === "admin" || currentUser.role === "general_manager"
        ? {}
        : currentUser.role === "sales_manager" || currentUser.role === "team_manager"
        ? {
            teamId: {
              in: await (async () => {
                const accessibleUserIds = await getAccessibleUserIds(currentUser);
                const teams = await prisma.team.findMany({
                  where: { members: { some: { id: { in: accessibleUserIds } } } },
                  select: { id: true },
                });
                return teams.map((t) => t.id);
              })(),
            },
          }
        : { assignedToId: currentUser.id };

    const where = {
      ...scopedFilter,
      ...(q
        ? {
            OR: [
              { nameAr: { contains: q, mode: "insensitive" as const } },
              { nameEn: { contains: q, mode: "insensitive" as const } },
              { code:   { contains: q, mode: "insensitive" as const } },
              { phone:  { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status === "active"
        ? { isActive: true }
        : status === "inactive"
        ? { isActive: false }
        : {}),
    };

    const [customers, count] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { nameAr: "asc" },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, code: true, nameAr: true, nameEn: true, phone: true,
          balance: true, creditLimit: true, isActive: true, createdAt: true,
          assignedTo: { select: { name: true, email: true } },
          team:       { select: { nameAr: true } },
          region:     { select: { nameAr: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    total = count;
    rows  = customers.map((c) => ({
      id:             c.id,
      code:           c.code,
      nameAr:         c.nameAr,
      nameEn:         c.nameEn,
      phone:          c.phone,
      balance:        c.balance.toFixed(2),
      creditLimit:    c.creditLimit ? c.creditLimit.toFixed(2) : null,
      isActive:       c.isActive,
      createdAt:      c.createdAt,
      assignedToName: c.assignedTo?.name ?? c.assignedTo?.email ?? null,
      teamNameAr:     c.team?.nameAr ?? null,
      regionNameAr:   c.region?.nameAr ?? null,
    }));
  } catch {
    pageError = "تعذر تحميل قائمة العملاء. يرجى المحاولة مجدداً.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Breadcrumb
            items={[
              { label: "الرئيسية", href: "/ar/dashboard" },
              { label: "العملاء" },
            ]}
          />
          <h1 className="text-2xl font-bold text-text-primary mt-2">العملاء</h1>
          {!pageError && (
            <p className="text-sm text-text-secondary mt-0.5">
              <span className="num">{total}</span> عميل
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CustomerExcelActions canImport={canCreate} />
          {canCreate && (
            <Link href="/ar/customers/new">
              <Button>
                <Plus size={16} />
                عميل جديد
              </Button>
            </Link>
          )}
        </div>
      </div>

      {pageError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="p-3 rounded-full bg-danger-50">
            <AlertTriangle size={24} className="text-danger-600" />
          </div>
          <p className="text-sm text-text-secondary max-w-sm">{pageError}</p>
        </div>
      ) : (
        <CustomersTable
          rows={rows}
          total={total}
          page={pageNum}
          pageSize={pageSize}
          q={q}
          status={status}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
