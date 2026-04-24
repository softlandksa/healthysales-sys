import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "./abilities";
import { ForbiddenError } from "@/lib/errors";
import { runWithAuditContext } from "@/lib/audit/request-context";
import type { SessionUser } from "@/types";
import type { Actions, Subjects } from "./abilities";

// Recursively fetch all descendant user IDs (BFS via self-relation)
async function _getAllDescendantIds(userId: string): Promise<string[]> {
  const ids: string[] = [userId];
  let queue = [userId];

  while (queue.length > 0) {
    const children = await prisma.user.findMany({
      where: { managerId: { in: queue }, isActive: true },
      select: { id: true },
    });
    queue = children.map((c) => c.id);
    ids.push(...queue);
  }

  return ids;
}

// Per-request cached version
export const getAccessibleUserIds = cache(
  async (user: SessionUser): Promise<string[]> => {
    switch (user.role) {
      case "admin":
        // All user IDs
        const all = await prisma.user.findMany({ select: { id: true } });
        return all.map((u) => u.id);

      case "general_manager":
      case "sales_manager":
        return _getAllDescendantIds(user.id);

      case "team_manager": {
        // Self + members of managed team
        if (!user.teamId) return [user.id];
        const members = await prisma.user.findMany({
          where: { teamId: user.teamId },
          select: { id: true },
        });
        const ids = new Set([user.id, ...members.map((m) => m.id)]);
        return [...ids];
      }

      case "sales_rep":
        return [user.id];
    }
  }
);

// Per-request cached accessible team IDs
export const getAccessibleTeamIds = cache(
  async (user: SessionUser): Promise<string[]> => {
    switch (user.role) {
      case "admin":
        const all = await prisma.team.findMany({ select: { id: true } });
        return all.map((t) => t.id);

      case "general_manager":
      case "sales_manager": {
        // Teams where any member is a descendant of this user
        const userIds = await _getAllDescendantIds(user.id);
        const teams = await prisma.team.findMany({
          where: { members: { some: { id: { in: userIds } } } },
          select: { id: true },
        });
        return teams.map((t) => t.id);
      }

      case "team_manager":
        if (!user.teamId) return [];
        return [user.teamId];

      case "sales_rep":
        if (!user.teamId) return [];
        return [user.teamId];
    }
  }
);

// Server-action wrapper: checks auth + CASL ability + seeds audit context
export async function withAuth<T>(
  action: Actions,
  subject: Subjects,
  handler: (user: SessionUser) => Promise<T>
): Promise<T> {
  const user = await requireUser();
  const ability = defineAbilitiesFor(user);

  if (!ability.can(action, subject)) {
    throw new ForbiddenError(`ليس لديك صلاحية ${action} على ${subject}`);
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const userAgent = hdrs.get("user-agent") ?? null;
  const requestId = hdrs.get("x-request-id") ?? crypto.randomUUID();

  return runWithAuditContext(
    { userId: user.id, ip, userAgent, requestId },
    () => handler(user)
  );
}
