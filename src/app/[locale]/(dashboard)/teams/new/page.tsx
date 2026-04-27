import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/prisma";
import { TeamForm } from "@/components/teams/TeamForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "إضافة فريق" };

interface Props { params: Promise<{ locale: string }> }

export default async function NewTeamPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("create", "Team")) redirect("/ar/teams");

  const managers = await prisma.user.findMany({
    where: { role: "team_manager", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "الفرق", href: "/ar/teams" },
            { label: "فريق جديد" },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">إضافة فريق جديد</h1>
      </div>
      <TeamForm mode="create" managers={managers} />
    </div>
  );
}
