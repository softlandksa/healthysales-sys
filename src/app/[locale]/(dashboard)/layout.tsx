import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { getMyNotifications, getUnreadCount } from "@/server/actions/notifications";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { PageTransition } from "@/components/layout/PageTransition";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  const [unreadCount, notifications] = await Promise.all([
    getUnreadCount(),
    getMyNotifications(5),
  ]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-1">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header user={user} unreadCount={unreadCount} notifications={notifications} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <MobileBottomNav />
      <FloatingActionButton role={user.role} />
    </div>
  );
}
