import { prisma } from "@/lib/db/prisma";
import type { TaskStatus } from "@prisma/client";
import type { TasksReportFilters, TasksReportData } from "../types";

export async function buildTasksReport(
  filters: TasksReportFilters,
  accessibleIds: string[]
): Promise<TasksReportData> {
  const assigneeFilter = filters.assignedToId ? [filters.assignedToId] : accessibleIds;
  const now = new Date();

  const baseWhere = {
    assignedToId: { in: assigneeFilter },
    createdAt:    { gte: filters.from, lte: filters.to },
    ...(filters.status ? { status: filters.status as TaskStatus } : {}),
  };

  const [tasksR, byStatusR, byAssigneeStatusR] = await Promise.allSettled([
    prisma.task.findMany({
      where: baseWhere,
      select: {
        id: true, title: true, status: true, dueDate: true, createdAt: true,
        assignedTo: { select: { name: true } },
        assignedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.task.groupBy({
      by:    ["status"],
      where: { assignedToId: { in: assigneeFilter }, createdAt: { gte: filters.from, lte: filters.to } },
      _count: { id: true },
    }),
    prisma.task.groupBy({
      by:    ["assignedToId", "status"],
      where: baseWhere,
      _count: { id: true },
    }),
  ] as const);

  const tasks              = tasksR.status             === "fulfilled" ? tasksR.value             : [];
  const byStatusGroups     = byStatusR.status          === "fulfilled" ? byStatusR.value          : [];
  const byAssigneeGroups   = byAssigneeStatusR.status  === "fulfilled" ? byAssigneeStatusR.value  : [];

  const getStatusCount = (s: string) => byStatusGroups.find((g) => g.status === s)?._count.id ?? 0;
  const total = byStatusGroups.reduce((s, g) => s + g._count.id, 0);

  const overdueCount = tasks.filter(
    (t) => t.dueDate < now && t.status !== "done" && t.status !== "cancelled"
  ).length;

  // Aggregate per assignee
  type AssigneeAgg = { pending: number; inProgress: number; done: number; blocked: number; cancelled: number };
  const assigneeAggMap = new Map<string, AssigneeAgg>();
  for (const g of byAssigneeGroups) {
    const cur = assigneeAggMap.get(g.assignedToId) ?? { pending: 0, inProgress: 0, done: 0, blocked: 0, cancelled: 0 };
    const n   = g._count.id;
    if      (g.status === "pending")     cur.pending    += n;
    else if (g.status === "in_progress") cur.inProgress += n;
    else if (g.status === "done")        cur.done       += n;
    else if (g.status === "blocked")     cur.blocked    += n;
    else if (g.status === "cancelled")   cur.cancelled  += n;
    assigneeAggMap.set(g.assignedToId, cur);
  }

  const userIds = [...assigneeAggMap.keys()];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }).catch(() => [])
    : [];
  const userNameMap = new Map(users.map((u) => [u.id, u.name]));

  return {
    summary: {
      total,
      pending:    getStatusCount("pending"),
      inProgress: getStatusCount("in_progress"),
      done:       getStatusCount("done"),
      blocked:    getStatusCount("blocked"),
      cancelled:  getStatusCount("cancelled"),
      overdue:    overdueCount,
    },
    byAssignee: [...assigneeAggMap.entries()]
      .map(([userId, agg]) => ({
        userId,
        userName:   userNameMap.get(userId) ?? null,
        total:      agg.pending + agg.inProgress + agg.done + agg.blocked + agg.cancelled,
        done:       agg.done,
        pending:    agg.pending,
        inProgress: agg.inProgress,
        blocked:    agg.blocked,
      }))
      .sort((a, b) => b.total - a.total),
    tasks: tasks.map((t) => ({
      id:         t.id,
      title:      t.title,
      status:     t.status,
      dueDate:    t.dueDate,
      assignedTo: t.assignedTo?.name ?? null,
      assignedBy: t.assignedBy?.name ?? null,
      isOverdue:  t.dueDate < now && t.status !== "done" && t.status !== "cancelled",
      createdAt:  t.createdAt,
    })),
  };
}
