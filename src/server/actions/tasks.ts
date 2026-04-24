"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withAuth, getAccessibleUserIds } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { notify } from "@/lib/notifications/notify";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { ActionResult, TaskStatus } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending:     ["in_progress", "cancelled"],
  in_progress: ["done", "blocked", "cancelled"],
  done:        [],
  blocked:     ["in_progress", "cancelled"],
  cancelled:   [],
};

function todayRiyadh(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

async function assertTaskAccess(
  taskId: string,
  accessibleIds: string[]
): Promise<{ id: string; title: string; status: TaskStatus; assignedToId: string; assignedById: string; completedAt: Date | null }> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [
        { assignedToId: { in: accessibleIds } },
        { assignedById: { in: accessibleIds } },
      ],
    },
    select: { id: true, title: true, status: true, assignedToId: true, assignedById: true, completedAt: true },
  });
  if (!task) throw new NotFoundError("المهمة غير موجودة");
  return { ...task, status: task.status as TaskStatus };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  title:       z.string().min(3, "العنوان مطلوب (3 أحرف على الأقل)").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  assignedToId: z.string().cuid("يجب اختيار مستخدم صالح"),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الاستحقاق غير صالح"),
});

const updateTaskSchema = z.object({
  title:       z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  assignedToId: z.string().cuid().optional(),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createTask(
  _prev: ActionResult<{ id: string }>,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return withAuth("create", "Task", async (currentUser) => {
    if (currentUser.role === "sales_rep") {
      throw new ForbiddenError("المندوبون لا يمكنهم إسناد المهام");
    }

    const raw = {
      title:        formData.get("title"),
      description:  formData.get("description") || undefined,
      assignedToId: formData.get("assignedToId"),
      dueDate:      formData.get("dueDate"),
    };

    const parsed = createTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    // Due date must be >= today (Riyadh)
    if (data.dueDate < todayRiyadh()) {
      return { success: false, error: "تاريخ الاستحقاق يجب أن يكون اليوم أو في المستقبل" };
    }

    // Validate assignedToId is accessible (except admin who can assign to anyone)
    const accessibleIds = await getAccessibleUserIds(currentUser);
    if (!accessibleIds.includes(data.assignedToId)) {
      throw new ForbiddenError("لا يمكنك إسناد مهمة لهذا المستخدم");
    }

    // Managers cannot self-assign (admin can)
    if (currentUser.role !== "admin" && data.assignedToId === currentUser.id) {
      return { success: false, error: "لا يمكنك إسناد مهمة لنفسك" };
    }

    const task = await prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          title:       data.title,
          ...(data.description && data.description !== "" && { description: data.description }),
          assignedById: currentUser.id,
          assignedToId: data.assignedToId,
          dueDate:     new Date(data.dueDate + "T00:00:00"),
        },
      });

      await notify({
        tx,
        userIds: [data.assignedToId],
        type:  "task_assigned",
        title: "تم إسناد مهمة جديدة",
        body:  data.title,
        link:  `/ar/tasks/${t.id}`,
        taskId: t.id,
      });

      return t;
    });

    await audit({
      action:     "create_task",
      entityType: "Task",
      entityId:   task.id,
      metadata:   { title: data.title, assignedToId: data.assignedToId, dueDate: data.dueDate },
      user:       currentUser,
    });

    revalidatePath("/ar/tasks");
    revalidateTag(`tasks-${data.assignedToId}`);
    return { success: true, data: { id: task.id } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إنشاء المهمة",
  }));
}

export async function updateTask(
  taskId: string,
  patch: { title?: string; description?: string; assignedToId?: string; dueDate?: string }
): Promise<ActionResult> {
  return withAuth("update", "Task", async (currentUser) => {
    if (currentUser.role === "sales_rep") {
      throw new ForbiddenError("المندوبون لا يمكنهم تعديل المهام");
    }

    const parsed = updateTaskSchema.safeParse(patch);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
    }

    const accessibleIds = await getAccessibleUserIds(currentUser);
    const task = await assertTaskAccess(taskId, accessibleIds);

    // Only the assigner (or admin) can edit task details
    if (currentUser.role !== "admin" && task.assignedById !== currentUser.id) {
      throw new ForbiddenError("يمكن فقط للمُسنِد تعديل تفاصيل المهمة");
    }

    const data = parsed.data;

    if (data.dueDate && data.dueDate < todayRiyadh()) {
      return { success: false, error: "تاريخ الاستحقاق يجب أن يكون اليوم أو في المستقبل" };
    }

    if (data.assignedToId) {
      if (!accessibleIds.includes(data.assignedToId)) {
        throw new ForbiddenError("لا يمكنك إسناد المهمة لهذا المستخدم");
      }
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description === "" ? null : data.description }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
        ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate + "T00:00:00") }),
      },
    });

    await audit({
      action:     "update_task",
      entityType: "Task",
      entityId:   taskId,
      metadata:   patch as Record<string, unknown>,
      user:       currentUser,
    });

    revalidatePath("/ar/tasks");
    revalidatePath(`/ar/tasks/${taskId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تحديث المهمة",
  }));
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  note?: string
): Promise<ActionResult> {
  return withAuth("update", "Task", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    const task = await assertTaskAccess(taskId, accessibleIds);

    const isAssignee = task.assignedToId === currentUser.id;
    const isAssigner = task.assignedById === currentUser.id;
    const isAdmin    = currentUser.role === "admin";

    if (!isAssignee && !isAssigner && !isAdmin) {
      throw new ForbiddenError("لا يمكنك تغيير حالة هذه المهمة");
    }

    // Terminal state re-open: admin only
    if (
      (task.status === "done" || task.status === "cancelled") &&
      !isAdmin
    ) {
      throw new ValidationError("لا يمكن إعادة فتح مهمة مكتملة أو ملغاة");
    }

    // Validate transition
    const allowed = isAdmin
      ? (Object.keys(VALID_TRANSITIONS) as TaskStatus[])  // admin: any transition
      : VALID_TRANSITIONS[task.status];

    if (!allowed.includes(newStatus)) {
      throw new ValidationError(`لا يمكن الانتقال من "${task.status}" إلى "${newStatus}"`);
    }

    const completedAt = newStatus === "done" ? new Date() : null;

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: newStatus,
          ...(newStatus === "done" ? { completedAt: new Date() } : completedAt === null && task.status === "done" ? { completedAt: null } : {}),
        },
      });

      // Notify the other party
      const notifyUserId = isAssignee ? task.assignedById : task.assignedToId;
      const statusLabels: Record<TaskStatus, string> = {
        pending:     "معلّقة",
        in_progress: "قيد التنفيذ",
        done:        "مكتملة",
        blocked:     "محجوبة",
        cancelled:   "ملغاة",
      };

      await notify({
        tx,
        userIds: [notifyUserId],
        type:   "task_status_changed",
        title:  `تم تحديث حالة المهمة: ${statusLabels[newStatus]}`,
        body:   note ?? task.title,
        link:   `/ar/tasks/${taskId}`,
        taskId,
      });
    });

    await audit({
      action:     "update_task_status",
      entityType: "Task",
      entityId:   taskId,
      metadata:   { from: task.status, to: newStatus, ...(note ? { note } : {}) },
      user:       currentUser,
    });

    revalidatePath("/ar/tasks");
    revalidatePath(`/ar/tasks/${taskId}`);
    revalidateTag(`tasks-${task.assignedToId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تحديث حالة المهمة",
  }));
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  return withAuth("delete", "Task", async (currentUser) => {
    if (!["admin", "general_manager", "sales_manager", "team_manager"].includes(currentUser.role)) {
      throw new ForbiddenError("حذف المهام للمديرين فقط");
    }

    const accessibleIds = await getAccessibleUserIds(currentUser);
    const task = await assertTaskAccess(taskId, accessibleIds);

    if (currentUser.role !== "admin" && task.assignedById !== currentUser.id) {
      throw new ForbiddenError("يمكن فقط للمُسنِد حذف المهمة");
    }

    await prisma.$transaction(async (tx) => {
      // Notify assignee if task wasn't done
      if (task.status !== "done" && task.status !== "cancelled") {
        await notify({
          tx,
          userIds: [task.assignedToId],
          type:   "task_deleted",
          title:  "تم حذف مهمة",
          body:   task.title,
        });
      }
      await tx.task.delete({ where: { id: taskId } });
    });

    await audit({
      action:     "delete_task",
      entityType: "Task",
      entityId:   taskId,
      metadata:   { title: task.title },
      user:       currentUser,
    });

    revalidatePath("/ar/tasks");
    revalidateTag(`tasks-${task.assignedToId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر حذف المهمة",
  }));
}

export async function addTaskComment(
  taskId: string,
  body: string
): Promise<ActionResult<{ id: string }>> {
  return withAuth("update", "Task", async (currentUser) => {
    if (!body.trim()) return { success: false, error: "التعليق لا يمكن أن يكون فارغاً" };
    if (body.length > 2000) return { success: false, error: "التعليق طويل جداً" };

    const accessibleIds = await getAccessibleUserIds(currentUser);
    const task = await assertTaskAccess(taskId, accessibleIds);

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.taskComment.create({
        data: { taskId, userId: currentUser.id, body: body.trim() },
      });

      // Notify the other party
      const notifyUserId = task.assignedToId === currentUser.id ? task.assignedById : task.assignedToId;
      if (notifyUserId !== currentUser.id) {
        await notify({
          tx,
          userIds: [notifyUserId],
          type:   "task_comment",
          title:  "تعليق جديد على مهمة",
          body:   body.trim().slice(0, 100),
          link:   `/ar/tasks/${taskId}`,
          taskId,
        });
      }

      return c;
    });

    revalidatePath(`/ar/tasks/${taskId}`);
    return { success: true, data: { id: comment.id } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إضافة التعليق",
  }));
}

export async function listTasks(filters: {
  status?: string;
  assignedToId?: string;
  assignedById?: string;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}) {
  return withAuth("read", "Task", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    const page     = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const isRepScope = currentUser.role === "sales_rep";

    const where = {
      ...(isRepScope
        ? { assignedToId: currentUser.id }
        : {
            OR: [
              { assignedToId: { in: accessibleIds } },
              { assignedById: { in: accessibleIds } },
            ],
          }),
      ...(filters.status ? { status: filters.status as TaskStatus } : {}),
      ...(filters.assignedToId && !isRepScope ? { assignedToId: filters.assignedToId } : {}),
      ...(filters.assignedById && !isRepScope ? { assignedById: filters.assignedById } : {}),
      ...(filters.overdue ? { dueDate: { lt: new Date() }, status: { notIn: ["done", "cancelled"] as TaskStatus[] } } : {}),
    };

    const now = new Date();
    const [raw, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, title: true, status: true, dueDate: true, completedAt: true,
          assignedTo: { select: { id: true, name: true } },
          assignedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    const tasks = raw.map((t) => ({
      id:             t.id,
      title:          t.title,
      status:         t.status as TaskStatus,
      dueDate:        t.dueDate,
      completedAt:    t.completedAt,
      assignedToId:   t.assignedTo.id,
      assignedToName: t.assignedTo.name,
      assignedByName: t.assignedBy.name,
      isOverdue:      t.dueDate < now && t.status !== "done" && t.status !== "cancelled",
    }));

    return { tasks, total };
  });
}

export async function getTaskDetail(taskId: string) {
  return withAuth("read", "Task", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { assignedToId: { in: accessibleIds } },
          { assignedById: { in: accessibleIds } },
        ],
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    if (!task) throw new NotFoundError("المهمة غير موجودة");
    return task;
  });
}
