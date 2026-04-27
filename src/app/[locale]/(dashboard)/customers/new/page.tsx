import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CustomerForm } from "@/components/customers/CustomerForm";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "عميل جديد" };

interface Props { params: Promise<{ locale: string }> }

export default async function NewCustomerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("create", "Customer")) redirect("/ar/customers");

  const accessibleIds = await getAccessibleUserIds(currentUser);

  const [reps, teams, regions] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({ orderBy: { nameAr: "asc" } }),
    prisma.region.findMany({ orderBy: { nameAr: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "العملاء", href: "/ar/customers" },
            { label: "عميل جديد" },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">عميل جديد</h1>
      </div>

      <CustomerForm
        mode="create"
        reps={reps.map((r) => ({ ...r, role: r.role as UserRole }))}
        teams={teams}
        regions={regions}
      />
    </div>
  );
}
