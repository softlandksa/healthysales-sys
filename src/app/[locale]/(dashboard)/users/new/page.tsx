import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/db/prisma";
import { UserForm } from "@/components/users/UserForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "إضافة مستخدم" };

interface Props { params: Promise<{ locale: string }> }

export default async function NewUserPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("create", "User")) redirect("/ar/users");

  const accessibleIds = await getAccessibleUserIds(currentUser);

  const [teams, users] = await Promise.all([
    prisma.team.findMany({ orderBy: { nameAr: "asc" } }),
    prisma.user.findMany({
      where: { id: { in: accessibleIds } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "المستخدمون", href: "/ar/users" },
            { label: "إضافة مستخدم" },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">إضافة مستخدم جديد</h1>
      </div>

      <UserForm
        mode="create"
        teams={teams}
        users={users}
        currentUserRole={currentUser.role}
      />
    </div>
  );
}
