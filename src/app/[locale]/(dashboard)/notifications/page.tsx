import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getMyNotificationsPaged } from "@/server/actions/notifications";
import { NotificationsClient } from "./NotificationsClient";

export const metadata: Metadata = { title: "الإشعارات" };

export default async function NotificationsPage() {
  await requireUser();
  const { items, nextCursor } = await getMyNotificationsPaged();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">الإشعارات</h1>
        <p className="text-sm text-text-secondary mt-1">جميع إشعاراتك مرتبة زمنياً</p>
      </div>
      <NotificationsClient initialItems={items} initialNextCursor={nextCursor} />
    </div>
  );
}
