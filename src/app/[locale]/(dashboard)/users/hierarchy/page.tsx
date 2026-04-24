import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/db/prisma";
import { HierarchyTree } from "@/components/users/HierarchyTree";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { HierarchyNode } from "@/components/users/HierarchyTree";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "الهيكل التنظيمي" };

interface Props { params: Promise<{ locale: string }> }

interface FlatUser {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  managerId: string | null;
}

function buildTree(users: FlatUser[], parentId: string | null): HierarchyNode[] {
  return users
    .filter((u) => u.managerId === parentId)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      children: buildTree(users, u.id),
    }));
}

export default async function HierarchyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "User")) redirect("/ar/dashboard");

  const accessibleIds = await getAccessibleUserIds(currentUser);
  const accessibleSet = new Set(accessibleIds);

  const rawUsers = await prisma.user.findMany({
    where: { id: { in: accessibleIds } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      managerId: true,
    },
    orderBy: { name: "asc" },
  });

  const users: FlatUser[] = rawUsers.map((u) => ({ ...u, role: u.role as UserRole }));

  // Root nodes: in accessible set but manager is null or outside accessible set
  const roots = users.filter(
    (u) => u.managerId === null || !accessibleSet.has(u.managerId)
  );

  const treeRoots =
    roots.length > 0
      ? roots.map((root) => ({
          id: root.id,
          name: root.name,
          email: root.email,
          role: root.role,
          isActive: root.isActive,
          children: buildTree(users, root.id),
        }))
      : buildTree(users, null);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "المستخدمون", href: "/ar/users" },
            { label: "الهيكل التنظيمي" },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">الهيكل التنظيمي</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          <span className="num">{users.length}</span> مستخدم في نطاق صلاحيتك
        </p>
      </div>

      <HierarchyTree roots={treeRoots} />
    </div>
  );
}
