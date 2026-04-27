import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleTeamIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { TeamTable } from "@/components/teams/TeamTable";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { TeamRow } from "@/types";

export const metadata: Metadata = { title: "الفرق" };

interface Props { params: Promise<{ locale: string }> }

export default async function TeamsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Team")) redirect("/ar/dashboard");

  const accessibleTeamIds = await getAccessibleTeamIds(currentUser);

  const teams = await prisma.team.findMany({
    where: { id: { in: accessibleTeamIds } },
    include: {
      manager: { select: { name: true } },
      _count: { select: { members: true } },
    },
    orderBy: { nameAr: "asc" },
  });

  const rows: TeamRow[] = teams.map((t) => ({
    id: t.id,
    nameAr: t.nameAr,
    nameEn: t.nameEn,
    managerId: t.managerId,
    managerName: t.manager?.name ?? null,
    memberCount: t._count.members,
    createdAt: t.createdAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: "الرئيسية", href: "/ar/dashboard" }, { label: "الفرق" }]} />
        <h1 className="text-2xl font-bold text-text-primary mt-2">الفرق</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          إجمالي <span className="num font-semibold text-text-primary">{rows.length}</span> فريق
        </p>
      </div>

      <TeamTable
        teams={rows}
        canCreate={ability.can("create", "Team")}
        canDelete={ability.can("delete", "Team")}
      />
    </div>
  );
}
