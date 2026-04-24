"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withAuth } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getAccessibleTeamIds } from "@/lib/rbac/access";
import type { ActionResult } from "@/types";

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const createTeamSchema = z.object({
  nameAr: z.string().min(2, "اسم الفريق يجب أن يكون حرفين على الأقل").max(100),
  nameEn: z.string().max(100).optional().or(z.literal("")),
  managerId: z.string().cuid().optional().or(z.literal("")),
});

export const updateTeamSchema = z.object({
  nameAr: z.string().min(2).max(100).optional(),
  nameEn: z.string().max(100).optional().or(z.literal("")),
  managerId: z.string().cuid().optional().or(z.literal("")),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createTeam(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return withAuth("create", "Team", async (currentUser) => {
    const parsed = createTeamSchema.safeParse({
      nameAr: formData.get("nameAr"),
      nameEn: formData.get("nameEn") || undefined,
      managerId: formData.get("managerId") || undefined,
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
    }

    const { nameAr, nameEn, managerId } = parsed.data;

    const team = await prisma.team.create({
      data: {
        nameAr,
        nameEn: nameEn || null,
        managerId: managerId || null,
      },
    });

    // If manager is set, update that user's teamId
    if (managerId) {
      await prisma.user.update({
        where: { id: managerId },
        data: { teamId: team.id },
      });
    }

    await audit({
      action: "create_team",
      entityType: "Team",
      entityId: team.id,
      metadata: { nameAr },
      user: currentUser,
    });

    revalidatePath("/ar/teams");
    return { success: true, data: { id: team.id } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إنشاء الفريق",
  }));
}

export async function updateTeam(
  teamId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withAuth("update", "Team", async (currentUser) => {
    const accessibleIds = await getAccessibleTeamIds(currentUser);
    if (!accessibleIds.includes(teamId)) {
      throw new ForbiddenError("ليس لديك صلاحية تعديل هذا الفريق");
    }

    const parsed = updateTeamSchema.safeParse({
      nameAr: formData.get("nameAr") || undefined,
      nameEn: formData.get("nameEn") || undefined,
      managerId: formData.get("managerId") || undefined,
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.nameEn !== undefined && { nameEn: data.nameEn || null }),
        ...(data.managerId !== undefined && { managerId: data.managerId || null }),
      },
    });

    await audit({
      action: "update_team",
      entityType: "Team",
      entityId: teamId,
      metadata: { changes: data },
      user: currentUser,
    });

    revalidatePath("/ar/teams");
    revalidatePath(`/ar/teams/${teamId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تحديث الفريق",
  }));
}

export async function deleteTeam(teamId: string): Promise<ActionResult> {
  return withAuth("delete", "Team", async (currentUser) => {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { members: true } } },
    });

    if (!team) throw new NotFoundError("الفريق غير موجود");

    if (team._count.members > 0) {
      throw new ValidationError(
        `لا يمكن حذف فريق يحتوي على ${team._count.members} عضو. أزل الأعضاء أولاً`
      );
    }

    await prisma.team.delete({ where: { id: teamId } });

    await audit({
      action: "delete_team",
      entityType: "Team",
      entityId: teamId,
      metadata: { nameAr: team.nameAr },
      user: currentUser,
    });

    revalidatePath("/ar/teams");
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر حذف الفريق",
  }));
}

export async function assignTeamManager(
  teamId: string,
  managerId: string
): Promise<ActionResult> {
  return withAuth("update", "Team", async (currentUser) => {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError("الفريق غير موجود");

    const manager = await prisma.user.findUnique({ where: { id: managerId } });
    if (!manager) throw new NotFoundError("المستخدم غير موجود");
    if (manager.role !== "team_manager") {
      throw new ValidationError("يجب أن يكون المستخدم بدور مدير فريق");
    }

    await prisma.$transaction([
      prisma.team.update({
        where: { id: teamId },
        data: { managerId },
      }),
      prisma.user.update({
        where: { id: managerId },
        data: { teamId },
      }),
    ]);

    await audit({
      action: "assign_team_manager",
      entityType: "Team",
      entityId: teamId,
      metadata: { managerId },
      user: currentUser,
    });

    revalidatePath("/ar/teams");
    revalidatePath(`/ar/teams/${teamId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تعيين مدير الفريق",
  }));
}

export async function addTeamMember(
  teamId: string,
  userId: string
): Promise<ActionResult> {
  return withAuth("update", "Team", async (currentUser) => {
    await prisma.user.update({
      where: { id: userId },
      data: { teamId },
    });

    await audit({
      action: "add_team_member",
      entityType: "Team",
      entityId: teamId,
      metadata: { userId },
      user: currentUser,
    });

    revalidatePath(`/ar/teams/${teamId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إضافة عضو",
  }));
}

export async function removeTeamMember(
  teamId: string,
  userId: string
): Promise<ActionResult> {
  return withAuth("update", "Team", async (currentUser) => {
    await prisma.user.update({
      where: { id: userId, teamId },
      data: { teamId: null },
    });

    await audit({
      action: "remove_team_member",
      entityType: "Team",
      entityId: teamId,
      metadata: { userId },
      user: currentUser,
    });

    revalidatePath(`/ar/teams/${teamId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إزالة العضو",
  }));
}
