import "server-only";
import { prisma } from "@/lib/prisma";

export interface NotifyInput {
  // Accept any transaction-like object (base or extended client tx)
  tx?:     unknown;
  userIds: string[];
  type:    string;
  title:   string;
  body?:   string;
  link?:   string;
  taskId?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  const { tx, userIds, type, title, body, link, taskId } = input;
  if (userIds.length === 0) return;

  // tx is either the extended client's tx or undefined — cast to the extended prisma type
  const db = ((tx as typeof prisma | undefined) ?? prisma);

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      ...(body   !== undefined && { body   }),
      ...(link   !== undefined && { link   }),
      ...(taskId !== undefined && { taskId }),
    })),
    skipDuplicates: false,
  });
}
