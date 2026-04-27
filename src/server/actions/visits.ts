"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, getAccessibleUserIds } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { nextVisitCode } from "@/lib/utils/sequences";
import type { ActionResult, VisitType } from "@/types";

const createVisitSchema = z.object({
  customerId: z.string().cuid(),
  visitType: z.enum(["visit_only", "sale", "collection"]),
  notes: z.string().max(2000).optional().or(z.literal("")),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function createVisit(
  _prev: ActionResult<{ id: string; visitType: VisitType }>,
  formData: FormData
): Promise<ActionResult<{ id: string; visitType: VisitType }>> {
  return withAuth("create", "Visit", async (currentUser) => {
    const raw = {
      customerId: formData.get("customerId"),
      visitType: formData.get("visitType"),
      notes: formData.get("notes") || undefined,
      latitude: formData.get("latitude") ? parseFloat(formData.get("latitude") as string) : undefined,
      longitude: formData.get("longitude") ? parseFloat(formData.get("longitude") as string) : undefined,
    };

    const parsed = createVisitSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    // Verify customer is accessible to this rep
    const customer = await prisma.customer.findFirst({
      where: {
        id: data.customerId,
        isActive: true,
        ...(currentUser.role === "sales_rep"
          ? { assignedToId: currentUser.id }
          : currentUser.role === "team_manager"
          ? { teamId: { in: await getTeamIdsForUser(currentUser.id) } }
          : {}),
      },
      select: { id: true, nameAr: true },
    });
    if (!customer) throw new ForbiddenError("هذا العميل غير متاح لك");

    const visit = await prisma.$transaction(async (tx) => {
      const code = await nextVisitCode(tx);
      return tx.visit.create({
        data: {
          code,
          visitType: data.visitType,
          ...(data.notes !== undefined && data.notes !== "" && { notes: data.notes }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          repId: currentUser.id,
          customerId: data.customerId,
        },
      });
    });

    await audit({
      action: "create_visit",
      entityType: "Visit",
      entityId: visit.id,
      metadata: { code: visit.code, visitType: data.visitType, customerId: data.customerId },
      user: currentUser,
    });

    revalidatePath("/ar/visits");
    revalidateTag(`customer-${data.customerId}`);

    return { success: true, data: { id: visit.id, visitType: data.visitType as VisitType } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إنشاء الزيارة",
  }));
}

export async function listVisits(filters: {
  from?: string;
  to?: string;
  repId?: string;
  customerId?: string;
  visitType?: string;
  page?: number;
  pageSize?: number;
}) {
  return withAuth("read", "Visit", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    const pageSize = filters.pageSize ?? 20;
    const page = filters.page ?? 1;

    const where = {
      repId: { in: accessibleIds },
      ...(filters.from || filters.to ? { visitedAt: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to + "T23:59:59") } : {}),
      }} : {}),
      ...(filters.repId && accessibleIds.includes(filters.repId) ? { repId: filters.repId } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.visitType ? { visitType: filters.visitType as VisitType } : {}),
    };

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        orderBy: { visitedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, code: true, visitType: true, notes: true, visitedAt: true,
          rep: { select: { name: true, id: true } },
          customer: { select: { nameAr: true, id: true } },
          salesOrder: { select: { id: true } },
          collection: { select: { id: true } },
        },
      }),
      prisma.visit.count({ where }),
    ]);

    return { visits, total };
  });
}

export async function getVisit(visitId: string) {
  return withAuth("read", "Visit", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);

    const visit = await prisma.visit.findFirst({
      where: { id: visitId, repId: { in: accessibleIds } },
      include: {
        rep: { select: { name: true, email: true, role: true } },
        customer: { select: { id: true, code: true, nameAr: true, phone: true } },
        salesOrder: { select: { id: true, code: true, status: true, total: true } },
        collection: { select: { id: true, code: true, amount: true, isCancelled: true } },
      },
    });

    if (!visit) throw new NotFoundError("الزيارة غير موجودة");
    return visit;
  });
}

// Helper — get team IDs for a user (used internally)
async function getTeamIdsForUser(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { teamId: true } });
  return user?.teamId ? [user.teamId] : [];
}
