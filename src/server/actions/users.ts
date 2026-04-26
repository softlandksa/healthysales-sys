"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withAuth } from "@/lib/rbac/access";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { requireUser } from "@/lib/auth/current-user";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { ActionResult } from "@/types";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const userRoleEnum = z.enum([
  "admin",
  "general_manager",
  "sales_manager",
  "team_manager",
  "sales_rep",
]);

export const createUserSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(100),
  email: z.string().email("بريد إلكتروني غير صالح"),
  phone: z.string().regex(/^[0-9+\s-]{7,20}$/, "رقم هاتف غير صالح").optional().or(z.literal("")),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  role: userRoleEnum,
  teamId: z.string().cuid().optional().or(z.literal("")),
  managerId: z.string().cuid().optional().or(z.literal("")),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^[0-9+\s-]{7,20}$/).optional().or(z.literal("")),
  role: userRoleEnum.optional(),
  teamId: z.string().cuid().optional().or(z.literal("")),
  managerId: z.string().cuid().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  userId: z.string().cuid(),
  newPassword: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createUser(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return withAuth("create", "User", async (currentUser) => {
    const raw = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
      password: formData.get("password"),
      role: formData.get("role"),
      teamId: (formData.get("teamId") === "none" ? "" : formData.get("teamId") as string) || undefined,
      managerId: (formData.get("managerId") === "none" ? "" : formData.get("managerId") as string) || undefined,
    };

    const parsed = createUserSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return { success: false, error: "البريد الإلكتروني مستخدم بالفعل" };
    }

    const hashed = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        password: hashed,
        role: data.role,
        teamId: data.teamId || null,
        managerId: data.managerId || null,
      },
    });

    if (data.role === "team_manager" && data.teamId) {
      await prisma.team.update({
        where: { id: data.teamId },
        data: { managerId: user.id },
      });
    }

    await audit({
      action: "create_user",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
      user: currentUser,
    });

    revalidatePath("/ar/users");
    return { success: true, data: { id: user.id } };
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "تعذر إنشاء المستخدم";
    return { success: false, error: message };
  });
}

export async function updateUser(
  userId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withAuth("update", "User", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    if (!accessibleIds.includes(userId)) {
      throw new ForbiddenError("ليس لديك صلاحية تعديل هذا المستخدم");
    }

    const raw = {
      name: formData.get("name") || undefined,
      phone: formData.get("phone") || undefined,
      role: formData.get("role") || undefined,
      teamId: (formData.get("teamId") === "none" ? "" : formData.get("teamId") as string) || undefined,
      managerId: (formData.get("managerId") === "none" ? "" : formData.get("managerId") as string) || undefined,
      isActive:
        formData.get("isActive") !== null
          ? formData.get("isActive") === "true"
          : undefined,
    };

    const parsed = updateUserSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;
    const oldUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!oldUser) throw new NotFoundError("المستخدم غير موجود");

    // Prevent deactivating the last active admin via edit form
    if (data.isActive === false && oldUser.role === "admin") {
      const activeAdminCount = await prisma.user.count({ where: { role: "admin", isActive: true } });
      if (activeAdminCount <= 1) {
        return { success: false, error: "لا يمكن تعطيل المدير الوحيد في النظام" };
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.teamId !== undefined && { teamId: data.teamId || null }),
        ...(data.managerId !== undefined && { managerId: data.managerId || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    if (data.role === "team_manager" && data.teamId) {
      await prisma.team.update({
        where: { id: data.teamId },
        data: { managerId: updated.id },
      });
    }

    await audit({
      action: "update_user",
      entityType: "User",
      entityId: userId,
      metadata: { changes: data },
      user: currentUser,
    });

    revalidatePath("/ar/users");
    revalidatePath(`/ar/users/${userId}/edit`);
    return { success: true };
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "تعذر تحديث المستخدم";
    return { success: false, error: message };
  });
}

export async function deactivateUser(userId: string): Promise<ActionResult> {
  return withAuth("update", "User", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    if (!accessibleIds.includes(userId)) {
      throw new ForbiddenError("ليس لديك صلاحية تعطيل هذا المستخدم");
    }
    if (userId === currentUser.id) {
      return { success: false, error: "لا يمكنك تعطيل حسابك الخاص" };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (targetUser?.role === "admin") {
      const activeAdminCount = await prisma.user.count({
        where: { role: "admin", isActive: true },
      });
      if (activeAdminCount <= 1) {
        return { success: false, error: "لا يمكن تعطيل المدير الوحيد في النظام" };
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await audit({
      action: "deactivate_user",
      entityType: "User",
      entityId: userId,
      user: currentUser,
    });

    revalidatePath("/ar/users");
    return { success: true };
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    return {
      success: false,
      error: err instanceof Error ? err.message : "تعذر تعطيل المستخدم",
    };
  });
}

export async function reactivateUser(userId: string): Promise<ActionResult> {
  return withAuth("update", "User", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    if (!accessibleIds.includes(userId)) {
      throw new ForbiddenError("ليس لديك صلاحية تفعيل هذا المستخدم");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    await audit({
      action: "reactivate_user",
      entityType: "User",
      entityId: userId,
      user: currentUser,
    });

    revalidatePath("/ar/users");
    return { success: true };
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    return {
      success: false,
      error: err instanceof Error ? err.message : "تعذر تفعيل المستخدم",
    };
  });
}

export async function changePassword(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withAuth("update", "User", async (currentUser) => {
    const parsed = changePasswordSchema.safeParse({
      userId: formData.get("userId"),
      newPassword: formData.get("newPassword"),
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
    }

    if (
      currentUser.role !== "admin" &&
      parsed.data.userId !== currentUser.id
    ) {
      throw new ForbiddenError("لا يمكنك تغيير كلمة مرور مستخدم آخر");
    }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { password: hashed },
    });

    await audit({
      action: "change_password",
      entityType: "User",
      entityId: parsed.data.userId,
      user: currentUser,
    });

    return { success: true };
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    return {
      success: false,
      error: err instanceof Error ? err.message : "تعذر تغيير كلمة المرور",
    };
  });
}

export async function resetMyPassword(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const currentUser = await requireUser();
  const newPassword = formData.get("newPassword") as string;

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: currentUser.id },
    data: { password: hashed },
  });

  await audit({
    action: "reset_own_password",
    entityType: "User",
    entityId: currentUser.id,
    user: currentUser,
  });

  return { success: true };
}
