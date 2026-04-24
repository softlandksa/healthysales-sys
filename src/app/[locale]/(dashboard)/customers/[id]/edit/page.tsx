import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/db/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CustomerForm } from "@/components/customers/CustomerForm";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "تعديل العميل" };

interface Props { params: Promise<{ locale: string; id: string }> }

export default async function EditCustomerPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("update", "Customer")) redirect("/ar/customers");

  const accessibleIds = await getAccessibleUserIds(currentUser);

  const [customer, reps, teams, regions] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      select: {
        id: true, code: true, nameAr: true, nameEn: true,
        phone: true, phone2: true, address: true, notes: true,
        creditLimit: true, regionId: true, assignedToId: true, teamId: true,
        isActive: true,
      },
    }),
    prisma.user.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({ orderBy: { nameAr: "asc" } }),
    prisma.region.findMany({ orderBy: { nameAr: "asc" } }),
  ]);

  if (!customer) notFound();

  const defaultValues = {
    nameAr: customer.nameAr,
    ...(customer.nameEn !== null && { nameEn: customer.nameEn }),
    ...(customer.phone !== null && { phone: customer.phone }),
    ...(customer.phone2 !== null && { phone2: customer.phone2 }),
    ...(customer.address !== null && { address: customer.address }),
    ...(customer.notes !== null && { notes: customer.notes }),
    ...(customer.creditLimit !== null && { creditLimit: customer.creditLimit.toFixed(2) }),
    ...(customer.regionId !== null && { regionId: customer.regionId }),
    ...(customer.assignedToId !== null && { assignedToId: customer.assignedToId }),
    ...(customer.teamId !== null && { teamId: customer.teamId }),
    isActive: customer.isActive,
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "العملاء", href: "/ar/customers" },
            { label: customer.nameAr },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">تعديل العميل</h1>
        <p className="text-sm text-text-secondary">{customer.code}</p>
      </div>

      <CustomerForm
        mode="edit"
        customerId={id}
        defaultValues={defaultValues}
        reps={reps.map((r) => ({ ...r, role: r.role as UserRole }))}
        teams={teams}
        regions={regions}
      />
    </div>
  );
}
