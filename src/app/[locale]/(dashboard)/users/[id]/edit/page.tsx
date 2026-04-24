import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/db/prisma";
import { UserForm, ChangePasswordForm } from "@/components/users/UserForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "تعديل المستخدم" };

interface Props { params: Promise<{ locale: string; id: string }> }

export default async function EditUserPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("update", "User")) redirect("/ar/users");

  const accessibleIds = await getAccessibleUserIds(currentUser);
  if (!accessibleIds.includes(id)) redirect("/ar/users");

  const [targetUser, teams, users] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, teamId: true, managerId: true, isActive: true,
      },
    }),
    prisma.team.findMany({ orderBy: { nameAr: "asc" } }),
    prisma.user.findMany({
      where: { id: { in: accessibleIds }, NOT: { id } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!targetUser) notFound();

  const canResetPassword = currentUser.role === "admin" || currentUser.id === id;

  // Build defaultValues without undefined (exactOptionalPropertyTypes)
  const defaultValues = {
    ...(targetUser.name !== null && { name: targetUser.name }),
    email: targetUser.email,
    ...(targetUser.phone !== null && { phone: targetUser.phone }),
    role: targetUser.role as UserRole,
    ...(targetUser.teamId !== null && { teamId: targetUser.teamId }),
    ...(targetUser.managerId !== null && { managerId: targetUser.managerId }),
    isActive: targetUser.isActive,
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "المستخدمون", href: "/ar/users" },
            { label: targetUser.name ?? targetUser.email },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">تعديل المستخدم</h1>
        <p className="text-sm text-text-secondary">{targetUser.email}</p>
      </div>

      <UserForm
        mode="edit"
        userId={id}
        defaultValues={defaultValues}
        teams={teams}
        users={users.map((u) => ({ ...u, role: u.role as UserRole }))}
        currentUserRole={currentUser.role}
      />

      {canResetPassword && <ChangePasswordForm userId={id} />}
    </div>
  );
}
