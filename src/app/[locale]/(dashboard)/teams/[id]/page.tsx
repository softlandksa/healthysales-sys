import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleTeamIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TeamMembersPanel } from "@/components/teams/TeamMembersPanel";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "تفاصيل الفريق" };

interface Props { params: Promise<{ locale: string; id: string }> }

export default async function TeamDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Team")) redirect("/ar/dashboard");

  const accessibleTeamIds = await getAccessibleTeamIds(currentUser);
  if (!accessibleTeamIds.includes(id)) redirect("/ar/teams");

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      members: {
        select: {
          id: true, name: true, email: true, phone: true,
          role: true, isActive: true,
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!team) notFound();

  const canManageMembers = ability.can("update", "Team");

  // Users not in this team (for "add member" dialog)
  const nonMembers = canManageMembers
    ? await prisma.user.findMany({
        where: {
          teamId: null,
          role: "sales_rep",
          isActive: true,
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "الفرق", href: "/ar/teams" },
            { label: team.nameAr },
          ]}
        />
        <div className="flex items-start justify-between mt-2 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{team.nameAr}</h1>
            {team.nameEn && <p className="text-sm text-text-secondary">{team.nameEn}</p>}
          </div>
          <Badge variant="default" className="gap-1.5">
            <Users size={13} />
            <span className="num">{team.members.length}</span> عضو
          </Badge>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">مدير الفريق</p>
          <p className="font-semibold text-text-primary">
            {team.manager?.name ?? <span className="text-text-muted font-normal">غير محدد</span>}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">عدد الأعضاء</p>
          <p className="font-semibold text-text-primary num">{team.members.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">تاريخ الإنشاء</p>
          <p className="font-semibold text-text-primary num">
            {team.createdAt.toLocaleDateString("ar-SA")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">الأعضاء</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <TeamMembersPanel
            teamId={id}
            members={team.members}
            nonMembers={nonMembers}
            canManage={canManageMembers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
