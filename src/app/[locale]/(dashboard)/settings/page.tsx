import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/db/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSystemSettings } from "@/server/actions/settings";
import { GeneralSettingsForm } from "@/components/settings/GeneralSettingsForm";
import { RegionsTab } from "@/components/settings/RegionsTab";
import { AccountTab } from "@/components/settings/AccountTab";

export const metadata: Metadata = { title: "الإعدادات" };

interface Props { params: Promise<{ locale: string }> }

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability     = defineAbilitiesFor(currentUser);
  const isAdmin     = ability.can("manage", "all");

  const [settings, regions, dbUser] = await Promise.all([
    getSystemSettings(),
    prisma.region.findMany({
      orderBy: { nameAr: "asc" },
      include: { _count: { select: { customers: true } } },
    }),
    prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { name: true, email: true, phone: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: "الرئيسية", href: "/ar/dashboard" }, { label: "الإعدادات" }]} />
        <h1 className="text-2xl font-bold text-text-primary mt-2">الإعدادات</h1>
        <p className="text-sm text-text-secondary mt-0.5">إدارة إعدادات النظام والحساب الشخصي</p>
      </div>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="mb-6">
          <TabsTrigger value="general">إعدادات النظام</TabsTrigger>
          <TabsTrigger value="regions">المناطق</TabsTrigger>
          <TabsTrigger value="account">الحساب الشخصي</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsForm settings={settings} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="regions">
          <RegionsTab regions={regions} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="account">
          <AccountTab
            name={dbUser?.name ?? ""}
            email={dbUser?.email ?? currentUser.email}
            phone={dbUser?.phone ?? ""}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
