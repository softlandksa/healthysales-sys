"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withAuth } from "@/lib/rbac/access";
import { requireUser } from "@/lib/auth/current-user";
import type { ActionResult, NotificationItem } from "@/types";

const PAGE = 30;

export async function getMyNotificationsPaged(
  cursor?: string,
  type?: string
): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(type ? { type } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    select: { id: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true },
  });
  const hasMore = rows.length > PAGE;
  const items   = hasMore ? rows.slice(0, PAGE) : rows;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

export async function getMyNotifications(limit = 10): Promise<NotificationItem[]> {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true },
  });
  return rows;
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();
  return prisma.notification.count({ where: { userId: user.id, isRead: false } });
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  return withAuth("read", "Task", async (currentUser) => {
    if (ids && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: currentUser.id },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: currentUser.id, isRead: false },
        data: { isRead: true },
      });
    }
    revalidatePath("/ar");
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "حدث خطأ",
  }));
}
