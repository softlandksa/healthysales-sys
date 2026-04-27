import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/users/UserForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AlertTriangle } from "lucide-react";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "إضافة مستخدم" };

interface Props { params: Promise<{ locale: string }> }

interface TeamOption { id: string; nameAr: string; }
interface UserOption { id: string; name: string | null; email: string; role: UserRole; }

export default async function NewUserPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("create", "User")) redirect("/ar/users");

  let teams: TeamOption[] = [];
  let users: UserOption[] = [];
  let pageError: string | null = null;

  try {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    [teams, users] = await Promise.all([
      prisma.team.findMany({ orderBy: { nameAr: "asc" } }),
      prisma.user.findMany({
        where: { id: { in: accessibleIds } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);
  } catch {
    pageError = "تعذر تحميل بيانات النموذج. يرجى المحاولة مجدداً.";
  }

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

      {pageError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="p-3 rounded-full bg-danger-50">
            <AlertTriangle size={24} className="text-danger-600" />
          </div>
          <p className="text-sm text-text-secondary max-w-sm">{pageError}</p>
        </div>
      ) : (
        <UserForm
          mode="create"
          teams={teams}
          users={users as UserOption[]}
          currentUserRole={currentUser.role}
        />
      )}
    </div>
  );
}
