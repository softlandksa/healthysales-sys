import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { RepDashboard } from "@/components/dashboards/rep-dashboard";
import { TeamManagerDashboard } from "@/components/dashboards/team-manager-dashboard";
import { SalesManagerDashboard } from "@/components/dashboards/sales-manager-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";

export const metadata: Metadata = {
  title: "لوحة التحكم",
};

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();

  switch (user.role) {
    case "sales_rep":
      return <RepDashboard user={user} />;
    case "team_manager":
      return <TeamManagerDashboard user={user} />;
    case "sales_manager":
      return <SalesManagerDashboard user={user} />;
    case "admin":
    case "general_manager":
      return <AdminDashboard />;
  }
}
