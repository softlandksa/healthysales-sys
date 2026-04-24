"use server";

import { cache } from "react";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withAuth, getAccessibleUserIds } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { notify } from "@/lib/notifications/notify";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { computeCompetitionStatus, competitionEndBound } from "@/lib/competitions/status";
import type { ActionResult, CompetitionStatus, CompetitionRow, LeaderboardEntry } from "@/types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** BFS to find all sales_rep IDs in a competition creator's org subtree. */
async function getCreatorSubtreeRepIds(creatorId: string): Promise<string[]> {
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { role: true },
  });
  if (!creator) return [];

  if (creator.role === "admin") {
    const all = await prisma.user.findMany({ where: { role: "sales_rep" }, select: { id: true } });
    return all.map((u) => u.id);
  }

  const allDescendantIds: string[] = [];
  let queue = [creatorId];

  while (queue.length > 0) {
    const children = await prisma.user.findMany({
      where: { managerId: { in: queue } },
      select: { id: true },
    });
    queue = children.map((c) => c.id);
    allDescendantIds.push(...queue);
  }

  if (allDescendantIds.length === 0) return [];

  const reps = await prisma.user.findMany({
    where: { id: { in: allDescendantIds }, role: "sales_rep" },
    select: { id: true },
  });
  return reps.map((r) => r.id);
}

/** If the persisted status is stale, update it and optionally record results. */
async function lazyStatusSync(competitionId: string): Promise<void> {
  const c = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { status: true, startDate: true, endDate: true },
  });
  if (!c) return;

  const computed = computeCompetitionStatus(c as { startDate: Date; endDate: Date; status: CompetitionStatus }, new Date());
  if (computed === c.status) return;

  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: computed },
  });

  if (computed === "ended") {
    // Fire-and-forget: record results after the competition ends
    recordCompetitionResults(competitionId).catch(() => void 0);
  }
}

/** Get all sales_rep user IDs in the competition's creator scope for notifications. */
async function getEligibleRepUserIds(creatorId: string): Promise<string[]> {
  return getCreatorSubtreeRepIds(creatorId);
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const todayRiyadh = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

const createCompetitionSchema = z.object({
  name:      z.string().min(3, "الاسم مطلوب (3 أحرف على الأقل)").max(120),
  productId: z.string().cuid("يجب اختيار منتج صالح"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ البدء غير صالح"),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الانتهاء غير صالح"),
  prize:     z.string().min(2, "الجائزة مطلوبة").max(300),
  notes:     z.string().max(2000).optional().or(z.literal("")),
});

const updateCompetitionSchema = z.object({
  name:    z.string().min(3).max(120).optional(),
  prize:   z.string().min(2).max(300).optional(),
  notes:   z.string().max(2000).optional().or(z.literal("")),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createCompetition(
  _prev: ActionResult<{ id: string }>,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return withAuth("create", "Competition", async (currentUser) => {
    if (!["admin", "general_manager", "sales_manager"].includes(currentUser.role)) {
      throw new ForbiddenError("إنشاء المسابقات للمديرين فقط");
    }

    const raw = {
      name:      formData.get("name"),
      productId: formData.get("productId"),
      startDate: formData.get("startDate"),
      endDate:   formData.get("endDate"),
      prize:     formData.get("prize"),
      notes:     formData.get("notes") || undefined,
    };

    const parsed = createCompetitionSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;
    const today = todayRiyadh();

    if (data.startDate < today) {
      return { success: false, error: "تاريخ البدء لا يمكن أن يكون في الماضي" };
    }
    if (data.endDate <= data.startDate) {
      return { success: false, error: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء" };
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true, nameAr: true },
    });
    if (!product) return { success: false, error: "المنتج غير موجود" };

    const startDate = new Date(data.startDate + "T00:00:00");
    const endDate   = new Date(data.endDate   + "T00:00:00");
    const now       = new Date();
    const initialStatus = computeCompetitionStatus(
      { startDate, endDate, status: "upcoming" },
      now
    );

    const competition = await prisma.competition.create({
      data: {
        name:   data.name,
        status: initialStatus,
        prize:  data.prize,
        ...(data.notes && data.notes !== "" && { notes: data.notes }),
        startDate,
        endDate,
        productId:   data.productId,
        createdById: currentUser.id,
      },
    });

    // Notify all eligible reps
    const repIds = await getEligibleRepUserIds(currentUser.id);
    if (repIds.length > 0) {
      await notify({
        userIds: repIds,
        type:    "competition_started",
        title:   `مسابقة جديدة: ${data.name}`,
        body:    `الجائزة: ${data.prize}`,
        link:    `/ar/competitions/${competition.id}`,
      });
    }

    await audit({
      action:     "create_competition",
      entityType: "Competition",
      entityId:   competition.id,
      metadata:   { name: data.name, productId: data.productId, startDate: data.startDate, endDate: data.endDate },
      user:       currentUser,
    });

    revalidatePath("/ar/competitions");
    return { success: true, data: { id: competition.id } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إنشاء المسابقة",
  }));
}

export async function updateCompetition(
  competitionId: string,
  patch: { name?: string; prize?: string; notes?: string; endDate?: string }
): Promise<ActionResult> {
  return withAuth("update", "Competition", async (currentUser) => {
    if (!["admin", "general_manager", "sales_manager"].includes(currentUser.role)) {
      throw new ForbiddenError("تعديل المسابقات للمديرين فقط");
    }

    const parsed = updateCompetitionSchema.safeParse(patch);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
    }

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, status: true, startDate: true, endDate: true, createdById: true },
    });
    if (!competition) throw new NotFoundError("المسابقة غير موجودة");

    if (currentUser.role !== "admin" && competition.createdById !== currentUser.id) {
      throw new ForbiddenError("يمكن فقط للمنشئ أو المدير العام تعديل المسابقة");
    }

    const liveStatus = computeCompetitionStatus(
      competition as { startDate: Date; endDate: Date; status: CompetitionStatus },
      new Date()
    );
    if (liveStatus === "ended" || liveStatus === "cancelled") {
      return { success: false, error: "لا يمكن تعديل مسابقة منتهية أو ملغاة" };
    }

    const data = parsed.data;
    if (data.endDate) {
      const today = todayRiyadh();
      if (data.endDate < today) {
        return { success: false, error: "تاريخ الانتهاء لا يمكن أن يكون في الماضي" };
      }
      if (data.endDate <= competition.startDate.toISOString().slice(0, 10)) {
        return { success: false, error: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء" };
      }
    }

    await prisma.competition.update({
      where: { id: competitionId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.prize !== undefined && { prize: data.prize }),
        ...(data.notes !== undefined && { notes: data.notes === "" ? null : data.notes }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate + "T00:00:00") }),
      },
    });

    await audit({
      action:     "update_competition",
      entityType: "Competition",
      entityId:   competitionId,
      metadata:   patch as Record<string, unknown>,
      user:       currentUser,
    });

    revalidatePath("/ar/competitions");
    revalidatePath(`/ar/competitions/${competitionId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تحديث المسابقة",
  }));
}

export async function cancelCompetition(
  competitionId: string,
  reason: string
): Promise<ActionResult> {
  return withAuth("update", "Competition", async (currentUser) => {
    if (!["admin", "general_manager", "sales_manager"].includes(currentUser.role)) {
      throw new ForbiddenError("إلغاء المسابقات للمديرين فقط");
    }

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true, status: true, createdById: true },
    });
    if (!competition) throw new NotFoundError("المسابقة غير موجودة");

    if (currentUser.role !== "admin" && competition.createdById !== currentUser.id) {
      throw new ForbiddenError("يمكن فقط للمنشئ أو المدير العام إلغاء المسابقة");
    }

    if (competition.status === "cancelled") {
      return { success: false, error: "المسابقة ملغاة بالفعل" };
    }

    await prisma.competition.update({
      where: { id: competitionId },
      data: { status: "cancelled" },
    });

    const repIds = await getEligibleRepUserIds(competition.createdById);
    if (repIds.length > 0) {
      await notify({
        userIds: repIds,
        type:    "competition_cancelled",
        title:   `تم إلغاء المسابقة: ${competition.name}`,
        ...(reason ? { body: reason } : {}),
        link:    `/ar/competitions/${competitionId}`,
      });
    }

    await audit({
      action:     "cancel_competition",
      entityType: "Competition",
      entityId:   competitionId,
      metadata:   { reason },
      user:       currentUser,
    });

    revalidatePath("/ar/competitions");
    revalidatePath(`/ar/competitions/${competitionId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إلغاء المسابقة",
  }));
}

export async function listCompetitions(filters: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return withAuth("read", "Competition", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    const page     = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const where = {
      ...(currentUser.role === "sales_rep"
        ? { createdById: { in: accessibleIds } } // reps see competitions from their managers
        : {}),
      ...(filters.status ? { status: filters.status as CompetitionStatus } : {}),
    };

    const [raw, total] = await Promise.all([
      prisma.competition.findMany({
        where,
        orderBy: [{ startDate: "desc" }],
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select: {
          id: true, name: true, status: true, prize: true,
          startDate: true, endDate: true, productId: true,
          product:   { select: { nameAr: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.competition.count({ where }),
    ]);

    const now = new Date();
    const competitions: CompetitionRow[] = raw.map((c) => ({
      id:            c.id,
      name:          c.name,
      status:        computeCompetitionStatus(
        { startDate: c.startDate, endDate: c.endDate, status: c.status as CompetitionStatus },
        now
      ),
      productId:     c.productId,
      productName:   c.product.nameAr,
      startDate:     c.startDate,
      endDate:       c.endDate,
      prize:         c.prize,
      createdByName: c.createdBy.name,
    }));

    return { competitions, total };
  });
}

export async function getCompetitionDetail(competitionId: string) {
  return withAuth("read", "Competition", async () => {
    // Fire lazy status sync (non-blocking)
    lazyStatusSync(competitionId).catch(() => void 0);

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        product:   { select: { id: true, nameAr: true, code: true, unit: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        results: {
          orderBy: { rank: "asc" },
          include: { user: { select: { id: true, name: true, isActive: true } } },
        },
      },
    });

    if (!competition) throw new NotFoundError("المسابقة غير موجودة");

    const now = new Date();
    return {
      ...competition,
      status: computeCompetitionStatus(
        { startDate: competition.startDate, endDate: competition.endDate, status: competition.status as CompetitionStatus },
        now
      ) as CompetitionStatus,
    };
  });
}

// Per-request cached leaderboard query
export const getCompetitionLeaderboard = cache(
  async (competitionId: string, limit = 50): Promise<LeaderboardEntry[]> => {
    return withAuth("read", "Competition", async () => {
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { productId: true, startDate: true, endDate: true, createdById: true },
      });
      if (!competition) return [];

      const eligibleIds = await getCreatorSubtreeRepIds(competition.createdById);
      if (eligibleIds.length === 0) return [];

      const endBound = competitionEndBound(competition.endDate);

      type RawRow = {
        userId: string;
        name: string | null;
        team: string | null;
        units: bigint;
        value: string;
        lastCollectedAt: Date | null;
        isActive: boolean;
      };

      const rows = await prisma.$queryRaw<RawRow[]>(
        Prisma.sql`
          SELECT
            so.rep_id                                           AS "userId",
            u.name,
            t.name_ar                                           AS team,
            COALESCE(SUM(soi.quantity), 0)::int                 AS units,
            COALESCE(SUM(soi.quantity * soi.unit_price), 0)     AS value,
            MAX(so.collected_at)                                AS "lastCollectedAt",
            u.is_active                                         AS "isActive"
          FROM sales_orders so
          JOIN sales_order_items soi
            ON soi.order_id = so.id
           AND soi.product_id = ${competition.productId}
          JOIN users u
            ON u.id = so.rep_id
          LEFT JOIN teams t
            ON t.id = u.team_id
          WHERE so.competition_id = ${competitionId}
            AND so.status         = 'collected'
            AND so.collected_at  >= ${competition.startDate}
            AND so.collected_at   < ${endBound}
            AND so.rep_id         = ANY(${eligibleIds})
          GROUP BY so.rep_id, u.name, t.name_ar, u.is_active
          ORDER BY units DESC, value DESC, MIN(so.collected_at) ASC
          LIMIT ${limit}
        `
      );

      return rows.map((r, i) => ({
        rank:            i + 1,
        userId:          r.userId,
        name:            r.name,
        team:            r.team,
        units:           Number(r.units),
        value:           r.value,
        lastCollectedAt: r.lastCollectedAt,
        isInactive:      !r.isActive,
      }));
    }).then((r) => r as LeaderboardEntry[]).catch(() => []);
  }
);

export async function recordCompetitionResults(competitionId: string): Promise<void> {
  const entries = await getCompetitionLeaderboard(competitionId, 3);
  if (entries.length === 0) return;

  const top3 = entries.slice(0, 3);

  await prisma.$transaction(async (tx) => {
    // Idempotent: unique constraint on (competitionId, rank) skips duplicates
    await tx.competitionResult.createMany({
      data: top3.map((e) => ({
        competitionId,
        rank:  e.rank,
        userId: e.userId,
        units:  e.units,
        value:  new Prisma.Decimal(e.value),
      })),
      skipDuplicates: true,
    });

    // Notify winners
    const rankEmoji = ["🥇", "🥈", "🥉"];
    for (const entry of top3) {
      await notify({
        tx,
        userIds: [entry.userId],
        type:    "competition_winner",
        title:   `${rankEmoji[entry.rank - 1] ?? ""} تهانينا! المركز ${entry.rank}`,
        body:    `حققت ${entry.units} وحدة في المسابقة`,
        link:    `/ar/competitions/${competitionId}`,
      });
    }
  });
}

export async function getRepCompetitionStats(userId: string): Promise<{
  firstPlaceWins: number;
  recentWins: Array<{
    competitionId: string;
    competitionName: string;
    rank: number;
    units: number;
    recordedAt: Date;
  }>;
}> {
  const [firstPlaceWins, recentWins] = await Promise.all([
    prisma.competitionResult.count({
      where: { userId, rank: 1 },
    }),
    prisma.competitionResult.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 10,
      select: {
        rank: true, units: true, recordedAt: true,
        competition: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    firstPlaceWins,
    recentWins: recentWins.map((w) => ({
      competitionId:   w.competition.id,
      competitionName: w.competition.name,
      rank:            w.rank,
      units:           w.units,
      recordedAt:      w.recordedAt,
    })),
  };
}
