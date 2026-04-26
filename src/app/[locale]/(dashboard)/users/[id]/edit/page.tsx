import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/db/prisma";
import { UserForm, ChangePasswordForm } from "@/components/users/UserForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AlertTriangle } from "lucide-react";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "تعديل المستخدم" };

interface Props { params: Promise<{ locale: string; id: string }> }

function PageError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="p-3 rounded-full bg-danger-50">
        <AlertTriangle size={24} className="text-danger-600" />
      </div>
      <p className="text-sm text-text-secondary max-w-sm">{message}</p>
    </div>
  );
}

async function loadPageData(id: string, accessibleIds: string[]) {
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
  return { targetUser, teams, users };
}

export default async function EditUserPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("update", "User")) redirect("/ar/users");

  let accessibleIds: string[];
  try {
    accessibleIds = await getAccessibleUserIds(currentUser);
  } catch {
    return (
      <div className="space-y-6">
        <PageError message="تعذر التحقق من الصلاحيات. يرجى المحاولة مجدداً." />
      </div>
    );
  }

  if (!accessibleIds.includes(id)) redirect("/ar/users");

  let data: Awaited<ReturnType<typeof loadPageData>>;
  try {
    data = await loadPageData(id, accessibleIds);
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <Breadcrumb
            items={[
              { label: "الرئيسية", href: "/ar/dashboard" },
              { label: "المستخدمون", href: "/ar/users" },
              { label: "تعديل المستخدم" },
            ]}
          />
          <h1 className="text-2xl font-bold text-text-primary mt-2">تعديل المستخدم</h1>
        </div>
        <PageError message="تعذر تحميل بيانات المستخدم. يرجى المحاولة مجدداً." />
      </div>
    );
  }

  const { targetUser, teams, users } = data;

  if (!targetUser) return notFound();

  const canResetPassword = currentUser.role === "admin" || currentUser.id === id;

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
