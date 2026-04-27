import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/users/UserTable";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AlertTriangle } from "lucide-react";
import type { UserRow } from "@/types";

export const metadata: Metadata = { title: "المستخدمون" };

interface Props { params: Promise<{ locale: string }> }

export default async function UsersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "User")) redirect("/ar/dashboard");

  let rows: UserRow[] = [];
  let pageError: string | null = null;

  try {
    const accessibleIds = await getAccessibleUserIds(currentUser);

    const users = await prisma.user.findMany({
      where: { id: { in: accessibleIds } },
      include: {
        team: { select: { nameAr: true } },
        manager: { select: { name: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    rows = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      teamId: u.teamId,
      teamNameAr: u.team?.nameAr ?? null,
      managerId: u.managerId,
      managerName: u.manager?.name ?? null,
      createdAt: u.createdAt,
    }));
  } catch {
    pageError = "تعذر تحميل قائمة المستخدمين. يرجى المحاولة مجدداً.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <Breadcrumb items={[{ label: "الرئيسية", href: "/ar/dashboard" }, { label: "المستخدمون" }]} />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">المستخدمون</h1>
            {!pageError && (
              <p className="text-sm text-text-secondary mt-0.5">
                إجمالي{" "}
                <span className="num font-semibold text-text-primary">{rows.length}</span>{" "}
                مستخدم
              </p>
            )}
          </div>
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
        <UserTable
          users={rows}
          canCreate={ability.can("create", "User")}
          canEdit={ability.can("update", "User")}
        />
      )}
    </div>
  );
}
