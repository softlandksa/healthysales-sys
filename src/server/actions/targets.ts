"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withAuth, getAccessibleUserIds } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { currentMonthPeriod, currentQuarterPeriod } from "@/lib/targets/periods";
import { computeAchievementMetrics } from "@/lib/targets/compute";
import type {
  ActionResult,
  TargetRow,
  TargetPeriod,
  TargetMetric,
  Achievement,
} from "@/types";

// ─── Validation ───────────────────────────────────────────────────────────────

const TargetSchema = z.object({
  userId:      z.string().min(1),
  metric:      z.enum(["sales_amount", "collections_amount", "visits_count"]),
  period:      z.enum(["monthly", "quarterly", "yearly", "custom"]),
  periodStart: z.string().min(1),
  value:       z.coerce.number().positive(),
});

// ─── Period parsing ───────────────────────────────────────────────────────────

function parsePeriodStart(
  period: TargetPeriod,
  periodStartStr: string,
  formData?: FormData,
): { periodStart: Date; periodEnd: Date } {
  if (period === "monthly") {
    const [year, month] = periodStartStr.split("-").map(Number);
    if (!year || !month) throw new ValidationError("تنسيق الفترة غير صحيح");
    const ref = new Date(`${year}-${String(month).padStart(2, "0")}-15T12:00:00+03:00`);
    return currentMonthPeriod(ref);
  }
  if (period === "quarterly") {
    const match = periodStartStr.match(/^(\d{4})-Q(\d)$/);
    if (!match) throw new ValidationError("تنسيق الفترة ربع السنوية غير صحيح");
    const [, yearStr, qStr] = match;
    const year  = Number(yearStr);
    const q     = Number(qStr);
    const month = (q - 1) * 3 + 2;
    const ref   = new Date(`${year}-${String(month).padStart(2, "0")}-15T12:00:00+03:00`);
    return currentQuarterPeriod(ref);
  }
  if (period === "yearly") {
    const year = Number(periodStartStr);
    if (!year || year < 2000 || year > 2100) throw new ValidationError("السنة غير صحيحة");
    const periodStart = new Date(Date.UTC(year, 0, 1) - 3 * 60 * 60 * 1000);
    const periodEnd   = new Date(Date.UTC(year + 1, 0, 1) - 3 * 60 * 60 * 1000 - 1);
    return { periodStart, periodEnd };
  }
  // custom
  const customStart = formData?.get("customStart") as string | null;
  const customEnd   = formData?.get("customEnd")   as string | null;
  if (!customStart || !customEnd) throw new ValidationError("يرجى تحديد تواريخ الفترة المخصصة");
  const periodStart = new Date(`${customStart}T00:00:00+03:00`);
  const periodEnd   = new Date(`${customEnd}T23:59:59+03:00`);
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) throw new ValidationError("تواريخ غير صحيحة");
  if (periodEnd <= periodStart) throw new ValidationError("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
  return { periodStart, periodEnd };
}

// ─── Create target ────────────────────────────────────────────────────────────

export async function createTarget(
  _prev: ActionResult<{ id: string }>,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return withAuth("create", "Target", async (currentUser) => {
    const raw = Object.fromEntries(formData.entries());
    const parsed = TargetSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صحيحة" };
    }

    const { userId, metric, period, periodStart: periodStartStr, value } = parsed.data;

    const accessible = await getAccessibleUserIds(currentUser);
    if (!accessible.includes(userId)) {
      return { success: false, error: "ليس لديك صلاحية تعيين هدف لهذا المستخدم" };
    }

    let bounds: { periodStart: Date; periodEnd: Date };
    try {
      bounds = parsePeriodStart(period as TargetPeriod, periodStartStr, formData);
    } catch (e) {
      return { success: false, error: e instanceof ValidationError ? e.message : "فترة غير صحيحة" };
    }

    const target = await prisma.target.create({
      data: {
        userId,
        metric:      metric as TargetMetric,
        period:      period as TargetPeriod,
        periodStart: bounds.periodStart,
        periodEnd:   bounds.periodEnd,
        value:       new Prisma.Decimal(value),
        createdById: currentUser.id,
      },
    });

    await audit({
      action:     "target.create",
      entityType: "Target",
      entityId:   target.id,
      user:       currentUser,
    });
    revalidatePath("/ar/targets");
    revalidatePath("/ar/dashboard");

    return { success: true, data: { id: target.id } };
  });
}

// ─── Update target ────────────────────────────────────────────────────────────

export async function updateTarget(id: string, value: number): Promise<ActionResult> {
  return withAuth("update", "Target", async (currentUser) => {
    const existing = await prisma.target.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) throw new NotFoundError("الهدف غير موجود");

    const accessible = await getAccessibleUserIds(currentUser);
    if (!accessible.includes(existing.userId)) throw new ForbiddenError();

    await prisma.target.update({ where: { id }, data: { value: new Prisma.Decimal(value) } });
    await audit({ action: "target.update", entityType: "Target", entityId: id, user: currentUser });
    revalidatePath("/ar/targets");
    revalidatePath("/ar/dashboard");

    return { success: true };
  });
}

// ─── Delete target ────────────────────────────────────────────────────────────

export async function deleteTarget(id: string): Promise<ActionResult> {
  return withAuth("delete", "Target", async (currentUser) => {
    const existing = await prisma.target.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) throw new NotFoundError("الهدف غير موجود");

    const accessible = await getAccessibleUserIds(currentUser);
    if (!accessible.includes(existing.userId)) throw new ForbiddenError();

    await prisma.target.delete({ where: { id } });
    await audit({ action: "target.delete", entityType: "Target", entityId: id, user: currentUser });
    revalidatePath("/ar/targets");
    revalidatePath("/ar/dashboard");

    return { success: true };
  });
}

// ─── Bulk set targets ─────────────────────────────────────────────────────────

export async function bulkSetTargets(
  targets: Array<{ userId: string; metric: TargetMetric; period: TargetPeriod; periodKey: string; value: number }>
): Promise<ActionResult<{ count: number }>> {
  return withAuth("create", "Target", async (currentUser) => {
    const accessible = await getAccessibleUserIds(currentUser);
    let count = 0;

    for (const t of targets) {
      if (!accessible.includes(t.userId)) continue;
      const { periodStart, periodEnd } = parsePeriodStart(t.period, t.periodKey);
      await prisma.target.upsert({
        where: { userId_metric_periodStart: { userId: t.userId, metric: t.metric, periodStart } },
        create: {
          userId:      t.userId,
          metric:      t.metric,
          period:      t.period,
          periodStart,
          periodEnd,
          value:       new Prisma.Decimal(t.value),
          createdById: currentUser.id,
        },
        update: { value: new Prisma.Decimal(t.value) },
      });
      count++;
    }

    revalidatePath("/ar/targets");
    revalidatePath("/ar/dashboard");
    return { success: true, data: { count } };
  });
}

// ─── List targets ─────────────────────────────────────────────────────────────

export async function listTargets(opts?: {
  userId?: string;
  period?: TargetPeriod;
  periodKey?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ targets: TargetRow[]; total: number }> {
  return withAuth("read", "Target", async (currentUser) => {
    const page     = opts?.page     ?? 1;
    const pageSize = opts?.pageSize ?? 25;

    const accessible = await getAccessibleUserIds(currentUser);

    let periodStartFilter: Date | undefined;
    if (opts?.periodKey && opts?.period) {
      try {
        const { periodStart } = parsePeriodStart(opts.period, opts.periodKey);
        periodStartFilter = periodStart;
      } catch { /* ignore */ }
    }

    const where: Prisma.TargetWhereInput = {
      userId: { in: opts?.userId ? [opts.userId] : accessible },
      ...(opts?.period       ? { period: opts.period }           : {}),
      ...(periodStartFilter  ? { periodStart: periodStartFilter } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.target.findMany({
        where,
        orderBy: [{ periodStart: "desc" }, { userId: "asc" }],
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: {
          user:      { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.target.count({ where }),
    ]);

    return {
      targets: rows.map((t) => ({
        id:            t.id,
        period:        t.period as TargetPeriod,
        metric:        t.metric as TargetMetric,
        periodStart:   t.periodStart,
        periodEnd:     t.periodEnd,
        value:         t.value.toString(),
        userId:        t.userId,
        userName:      t.user.name,
        createdByName: t.createdBy?.name ?? null,
        createdAt:     t.createdAt,
      })),
      total,
    };
  });
}

// ─── List my targets ──────────────────────────────────────────────────────────

export async function listMyTargets(period?: TargetPeriod): Promise<TargetRow[]> {
  return withAuth("read", "Target", async (currentUser) => {
    let periodStartFilter: Date | undefined;
    if (period) {
      try {
        const now = new Date();
        const key = period === "monthly"
          ? currentMonthPeriod(now).periodKey
          : currentQuarterPeriod(now).periodKey;
        periodStartFilter = parsePeriodStart(period, key).periodStart;
      } catch { /* ignore */ }
    }

    const rows = await prisma.target.findMany({
      where: {
        userId: currentUser.id,
        ...(periodStartFilter ? { periodStart: periodStartFilter } : {}),
      },
      orderBy: { periodStart: "desc" },
      include: { createdBy: { select: { name: true } } },
    });

    return rows.map((t) => ({
      id:            t.id,
      period:        t.period as TargetPeriod,
      metric:        t.metric as TargetMetric,
      periodStart:   t.periodStart,
      periodEnd:     t.periodEnd,
      value:         t.value.toString(),
      userId:        t.userId,
      userName:      currentUser.name,
      createdByName: t.createdBy?.name ?? null,
      createdAt:     t.createdAt,
    }));
  });
}

// ─── Compute achievement for a single user ────────────────────────────────────

export async function computeAchievement(
  userId: string,
  period: TargetPeriod
): Promise<Achievement[]> {
  return withAuth("read", "Target", async (currentUser) => {
    const accessible = await getAccessibleUserIds(currentUser);
    if (!accessible.includes(userId) && currentUser.id !== userId) throw new ForbiddenError();

    const now    = new Date();
    const bounds = period === "monthly" ? currentMonthPeriod(now) : currentQuarterPeriod(now);
    const { periodStart, periodEnd } = bounds;

    const targets = await prisma.target.findMany({
      where: { userId, periodStart },
      select: { metric: true, value: true, periodStart: true, periodEnd: true },
    });
    if (targets.length === 0) return [];

    const [salesAgg, collectionsAgg, visitsCount] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: { repId: userId, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { total: true },
      }),
      prisma.collection.aggregate({
        where: { repId: userId, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      }),
      prisma.visit.count({
        where: { repId: userId, visitedAt: { gte: periodStart, lte: periodEnd } },
      }),
    ]);

    const actuals: Record<TargetMetric, number> = {
      sales_amount:       Number(salesAgg._sum.total ?? 0),
      collections_amount: Number(collectionsAgg._sum.amount ?? 0),
      visits_count:       visitsCount,
    };

    return targets.map((t) =>
      computeAchievementMetrics(
        {
          metric:      t.metric as TargetMetric,
          target:      Number(t.value),
          actual:      actuals[t.metric as TargetMetric],
          periodStart: t.periodStart,
          periodEnd:   t.periodEnd,
        },
        now
      )
    );
  });
}

// ─── Compute achievements for multiple users (batch) ─────────────────────────

export async function computeAchievementsForUsers(
  userIds: string[],
  period: TargetPeriod
): Promise<Map<string, Achievement[]>> {
  return withAuth("read", "Target", async () => {
    const now    = new Date();
    const bounds = period === "monthly" ? currentMonthPeriod(now) : currentQuarterPeriod(now);
    const { periodStart, periodEnd } = bounds;

    const targets = await prisma.target.findMany({
      where: { userId: { in: userIds }, periodStart },
      select: { userId: true, metric: true, value: true, periodStart: true, periodEnd: true },
    });
    if (targets.length === 0) return new Map();

    const [salesGroups, collGroups, visitGroups] = await Promise.all([
      prisma.salesOrder.groupBy({
        by:    ["repId"],
        where: { repId: { in: userIds }, status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum:  { total: true },
      }),
      prisma.collection.groupBy({
        by:    ["repId"],
        where: { repId: { in: userIds }, isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum:  { amount: true },
      }),
      prisma.visit.groupBy({
        by:    ["repId"],
        where: { repId: { in: userIds }, visitedAt: { gte: periodStart, lte: periodEnd } },
        _count: { id: true },
      }),
    ]);

    const salesMap = new Map(salesGroups.map((g) => [g.repId, Number(g._sum.total ?? 0)]));
    const collMap  = new Map(collGroups.map((g) => [g.repId, Number(g._sum.amount ?? 0)]));
    const visitMap = new Map(visitGroups.map((g) => [g.repId, g._count.id]));

    const result = new Map<string, Achievement[]>();
    for (const uid of userIds) {
      const repTargets = targets.filter((t) => t.userId === uid);
      if (repTargets.length === 0) continue;

      const actuals: Record<TargetMetric, number> = {
        sales_amount:       salesMap.get(uid) ?? 0,
        collections_amount: collMap.get(uid)  ?? 0,
        visits_count:       visitMap.get(uid) ?? 0,
      };

      result.set(
        uid,
        repTargets.map((t) =>
          computeAchievementMetrics(
            {
              metric:      t.metric as TargetMetric,
              target:      Number(t.value),
              actual:      actuals[t.metric as TargetMetric],
              periodStart: t.periodStart,
              periodEnd:   t.periodEnd,
            },
            now
          )
        )
      );
    }
    return result;
  });
}
