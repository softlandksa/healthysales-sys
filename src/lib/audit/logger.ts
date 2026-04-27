import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import type { Prisma } from "@prisma/client";

interface AuditParams {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  user: SessionUser | { id: string };
  tx?: Omit<
    Prisma.TransactionClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >;
}

function getClientIp(): string | null {
  try {
    const h = headers() as unknown as { get(k: string): string | null };
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null
    );
  } catch {
    return null;
  }
}

export async function audit(params: AuditParams): Promise<void> {
  const { action, entityType, entityId, metadata, user, tx } = params;
  const ip = getClientIp();
  const db = tx ?? prisma;

  try {
    await (db as typeof prisma).auditLog.create({
      data: {
        action,
        entityType,
        ...(entityId !== undefined && { entityId }),
        ...(metadata !== undefined && {
          metadata: metadata as Prisma.InputJsonValue,
        }),
        ...(ip !== null && { ipAddress: ip }),
        userId: user.id,
      },
    });
  } catch {
    console.error("[audit] failed to write audit log", { action, entityType });
  }
}
