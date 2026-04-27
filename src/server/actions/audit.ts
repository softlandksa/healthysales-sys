"use server";

import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/rbac/access";
import { getAccessibleUserIds } from "@/lib/rbac/access";

export interface AuditLogRow {
  id:         string;
  action:     string;
  entityType: string;
  entityId:   string | null;
  metadata:   unknown;
  ipAddress:  string | null;
  userId:     string | null;
  userName:   string | null;
  createdAt:  Date;
}

export interface AuditLogFilters {
  from?:       Date;
  to?:         Date;
  entityType?: string;
  userId?:     string;
  action?:     string;
  cursor?:     string;
}

export interface AuditLogTableFilters {
  from?:       Date;
  to?:         Date;
  entityType?: string;
  userId?:     string;
  action?:     string;
}

const PAGE = 50;

export async function getAuditLogs(
  filters: AuditLogFilters = {}
): Promise<{ rows: AuditLogRow[]; nextCursor: string | null }> {
  return withAuth("read", "AuditLog", async (user) => {
    if (user.role !== "admin" && user.role !== "general_manager") {
      throw new Error("غير مصرح");
    }

    const accessibleIds = await getAccessibleUserIds(user);

    const rows = await prisma.auditLog.findMany({
      where: {
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to   ? { lte: filters.to   } : {}),
              },
            }
          : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.action     ? { action: filters.action }         : {}),
        ...(filters.userId
          ? { userId: filters.userId }
          : { userId: { in: accessibleIds } }),
        ...(filters.cursor ? { id: { lt: filters.cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
      include: { user: { select: { id: true, name: true } } },
    });

    const hasMore = rows.length > PAGE;
    const data    = hasMore ? rows.slice(0, PAGE) : rows;

    return {
      rows: data.map((r) => ({
        id:         r.id,
        action:     r.action,
        entityType: r.entityType,
        entityId:   r.entityId,
        metadata:   r.metadata,
        ipAddress:  r.ipAddress,
        userId:     r.userId,
        userName:   r.user?.name ?? null,
        createdAt:  r.createdAt,
      })),
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
    };
  });
}

export async function getAuditEntityTypes(): Promise<string[]> {
  return withAuth("read", "AuditLog", async (user) => {
    if (user.role !== "admin" && user.role !== "general_manager") return [];
    const rows = await prisma.auditLog.groupBy({
      by: ["entityType"],
      orderBy: { entityType: "asc" },
    });
    return rows.map((r) => r.entityType);
  });
}
