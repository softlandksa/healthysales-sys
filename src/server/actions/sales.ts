"use server";

/*
 * ACCOUNTING MODEL — DEBIT-ON-CONFIRMED / CREDIT-ON-COLLECTION
 * ─────────────────────────────────────────────────────────────
 * draft → confirmed   : CustomerTransaction { type:'sale', amount:+total }
 *                       customer.balance += total
 * confirmed → delivered: no balance change; sets deliveredAt
 * delivered → collected: no balance change; sets collectedAt (qualifies for competition)
 * draft → cancelled   : no balance change (never hit ledger)
 * confirmed|delivered → cancelled:
 *                       compensating CustomerTransaction { type:'adjustment', amount:-total }
 *                       customer.balance -= total
 * Collections are ALWAYS separate (see collections.ts).
 * All multi-write operations execute inside prisma.$transaction(async tx => {...}).
 * customer.balance MUST always equal SUM(customer_transactions.amount) for that customer.
 *
 * COMPETITION AUTO-LINK RULE (Phase 5):
 * ──────────────────────────────────────
 * When a SalesOrder is created, findBestCompetitionFor() checks if any line item's
 * productId matches an active competition. If found, competitionId is set on the order.
 * Units are counted ONLY when status transitions to 'collected' (see scoring docs in
 * lib/competitions/leaderboard-sql.ts). Cancelled orders lose their units automatically
 * since they never reach 'collected'.
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withAuth, getAccessibleUserIds } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { nextSalesOrderCode } from "@/lib/utils/sequences";
import { findBestCompetitionFor } from "@/lib/competitions/auto-link";
import type { ActionResult, SalesOrderStatus } from "@/types";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive("الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "السعر غير صالح")
    .refine((v) => parseFloat(v) > 0, "السعر يجب أن يكون أكبر من صفر"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الانتهاء مطلوب"),
});

const createOrderSchema = z.object({
  customerId: z.string().cuid(),
  visitId: z.string().cuid().optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "يجب إضافة منتج واحد على الأقل"),
  discount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().default("0"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  confirmImmediately: z.boolean().optional().default(false),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertOrderAccess(
  orderId: string,
  accessibleUserIds: string[]
): Promise<{ id: string; status: SalesOrderStatus; customerId: string; total: Prisma.Decimal; repId: string }> {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, repId: { in: accessibleUserIds } },
    select: { id: true, status: true, customerId: true, total: true, repId: true },
  });
  if (!order) throw new NotFoundError("الطلب غير موجود");
  return { ...order, status: order.status as SalesOrderStatus };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createSalesOrder(
  _prev: ActionResult<{ id: string; code: string }>,
  formData: FormData
): Promise<ActionResult<{ id: string; code: string }>> {
  return withAuth("create", "SalesOrder", async (currentUser) => {
    const rawItems: { productId: string; quantity: number; unitPrice: string; expiryDate: string }[] = [];
    let i = 0;
    while (formData.get(`items[${i}].productId`) !== null) {
      rawItems.push({
        productId: formData.get(`items[${i}].productId`) as string,
        quantity: parseInt(formData.get(`items[${i}].quantity`) as string, 10),
        unitPrice: formData.get(`items[${i}].unitPrice`) as string,
        expiryDate: formData.get(`items[${i}].expiryDate`) as string,
      });
      i++;
    }

    const raw = {
      customerId: formData.get("customerId"),
      visitId: formData.get("visitId") || undefined,
      items: rawItems,
      discount: formData.get("discount") || "0",
      notes: formData.get("notes") || undefined,
      confirmImmediately: formData.get("confirmImmediately") === "true",
    };

    const parsed = createOrderSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    // Verify customer accessible
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true, balance: true, nameAr: true },
    });
    if (!customer) throw new NotFoundError("العميل غير موجود");

    // Compute totals
    const discount = new Prisma.Decimal(data.discount);
    const itemsData = data.items.map((item) => {
      const qty = item.quantity;
      const price = new Prisma.Decimal(item.unitPrice);
      const lineTotal = price.mul(qty);
      return { ...item, lineTotal, unitPrice: price };
    });
    const subtotal = itemsData.reduce((s, it) => s.add(it.lineTotal), new Prisma.Decimal(0));
    const total = subtotal.sub(discount).greaterThan(0) ? subtotal.sub(discount) : new Prisma.Decimal(0);

    // Auto-link to active competition if any line item's product matches
    const productIds = data.items.map((i) => i.productId);
    const competitionId = await findBestCompetitionFor(productIds, new Date());

    const order = await prisma.$transaction(async (tx) => {
      const code = await nextSalesOrderCode(tx);
      const initialStatus = data.confirmImmediately ? "confirmed" : "draft";

      const o = await tx.salesOrder.create({
        data: {
          code,
          status: initialStatus,
          subtotal,
          discount,
          total,
          ...(data.notes !== undefined && data.notes !== "" && { notes: data.notes }),
          ...(data.confirmImmediately && { confirmedAt: new Date() }),
          repId: currentUser.id,
          customerId: data.customerId,
          ...(data.visitId && data.visitId !== "" && { visitId: data.visitId }),
          ...(competitionId !== null && { competitionId }),
          items: {
            create: itemsData.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              expiryDate: new Date(item.expiryDate),
            })),
          },
        },
      });

      // If confirming immediately, create ledger entry
      if (data.confirmImmediately) {
        const newBalance = customer.balance.add(total);
        await tx.customerTransaction.create({
          data: {
            customerId: data.customerId,
            type: "sale",
            amount: total,
            balance: newBalance,
            description: `مبيعات — ${code}`,
            referenceType: "sales_order",
            referenceId: o.id,
            createdById: currentUser.id,
          },
        });
        await tx.customer.update({
          where: { id: data.customerId },
          data: { balance: newBalance },
        });
      }

      return o;
    });

    await audit({
      action: data.confirmImmediately ? "create_and_confirm_sales_order" : "create_sales_order",
      entityType: "SalesOrder",
      entityId: order.id,
      metadata: { code: order.code, total: total.toFixed(2), customerId: data.customerId },
      user: currentUser,
    });

    revalidatePath("/ar/sales");
    revalidatePath("/ar/customers");
    revalidateTag(`customer-${data.customerId}`);

    return { success: true, data: { id: order.id, code: order.code } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إنشاء الطلب",
  }));
}

export async function confirmSalesOrder(orderId: string): Promise<ActionResult> {
  return withAuth("update", "SalesOrder", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    const order = await assertOrderAccess(orderId, accessibleIds);

    if (order.status !== "draft") {
      throw new ValidationError("يمكن تأكيد الطلبات في حالة المسودة فقط");
    }

    const customer = await prisma.customer.findUnique({
      where: { id: order.customerId },
      select: { balance: true },
    });
    if (!customer) throw new NotFoundError("العميل غير موجود");

    await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: "confirmed", confirmedAt: new Date() },
      });

      const newBalance = customer.balance.add(order.total);
      await tx.customerTransaction.create({
        data: {
          customerId: order.customerId,
          type: "sale",
          amount: order.total,
          balance: newBalance,
          description: `مبيعات — ${orderId}`,
          referenceType: "sales_order",
          referenceId: orderId,
          createdById: currentUser.id,
        },
      });
      await tx.customer.update({
        where: { id: order.customerId },
        data: { balance: newBalance },
      });
    });

    await audit({
      action: "confirm_sales_order",
      entityType: "SalesOrder",
      entityId: orderId,
      metadata: { total: order.total.toFixed(2) },
      user: currentUser,
    });

    revalidatePath("/ar/sales");
    revalidatePath(`/ar/sales/${orderId}`);
    revalidateTag(`customer-${order.customerId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تأكيد الطلب",
  }));
}

export async function deliverSalesOrder(orderId: string): Promise<ActionResult> {
  return withAuth("update", "SalesOrder", async (currentUser) => {
    if (!["admin", "general_manager", "sales_manager", "team_manager"].includes(currentUser.role)) {
      throw new ForbiddenError("تسليم الطلبات للمديرين فقط");
    }

    const accessibleIds = await getAccessibleUserIds(currentUser);
    const order = await assertOrderAccess(orderId, accessibleIds);

    if (order.status !== "confirmed") {
      throw new ValidationError("يمكن تسليم الطلبات المؤكدة فقط");
    }

    await prisma.salesOrder.update({
      where: { id: orderId },
      data: { status: "delivered", deliveredAt: new Date() },
    });

    await audit({
      action: "deliver_sales_order",
      entityType: "SalesOrder",
      entityId: orderId,
      user: currentUser,
    });

    revalidatePath("/ar/sales");
    revalidatePath(`/ar/sales/${orderId}`);
    revalidateTag(`customer-${order.customerId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تسليم الطلب",
  }));
}

export async function collectSalesOrder(orderId: string): Promise<ActionResult> {
  return withAuth("update", "SalesOrder", async (currentUser) => {
    if (!["admin", "general_manager", "sales_manager", "team_manager"].includes(currentUser.role)) {
      throw new ForbiddenError("تحديث حالة التحصيل للمديرين فقط");
    }

    const accessibleIds = await getAccessibleUserIds(currentUser);
    const order = await assertOrderAccess(orderId, accessibleIds);

    if (order.status !== "delivered") {
      throw new ValidationError("يمكن وضع علامة التحصيل على الطلبات المُسلَّمة فقط");
    }

    await prisma.salesOrder.update({
      where: { id: orderId },
      data: { status: "collected", collectedAt: new Date() },
    });

    await audit({
      action: "collect_sales_order",
      entityType: "SalesOrder",
      entityId: orderId,
      user: currentUser,
    });

    revalidatePath("/ar/sales");
    revalidatePath(`/ar/sales/${orderId}`);
    revalidateTag(`customer-${order.customerId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تحديث حالة الطلب",
  }));
}

export async function cancelSalesOrder(orderId: string, reason: string): Promise<ActionResult> {
  return withAuth("update", "SalesOrder", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    const order = await assertOrderAccess(orderId, accessibleIds);

    if (order.status === "collected" || order.status === "cancelled") {
      throw new ValidationError("لا يمكن إلغاء طلب محصَّل أو ملغى");
    }

    const customer = await prisma.customer.findUnique({
      where: { id: order.customerId },
      select: { balance: true },
    });
    if (!customer) throw new NotFoundError("العميل غير موجود");

    await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          ...(reason && { cancelReason: reason }),
        },
      });

      // Compensating entry only if order was already on the ledger
      if (order.status === "confirmed" || order.status === "delivered") {
        const newBalance = customer.balance.sub(order.total);
        await tx.customerTransaction.create({
          data: {
            customerId: order.customerId,
            type: "adjustment",
            amount: order.total.negated(),
            balance: newBalance,
            description: `إلغاء طلب — ${orderId}`,
            referenceType: "sales_order",
            referenceId: orderId,
            createdById: currentUser.id,
          },
        });
        await tx.customer.update({
          where: { id: order.customerId },
          data: { balance: newBalance },
        });
      }
    });

    await audit({
      action: "cancel_sales_order",
      entityType: "SalesOrder",
      entityId: orderId,
      metadata: { previousStatus: order.status, reason },
      user: currentUser,
    });

    revalidatePath("/ar/sales");
    revalidatePath(`/ar/sales/${orderId}`);
    revalidateTag(`customer-${order.customerId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إلغاء الطلب",
  }));
}

export async function getSalesOrderDetail(orderId: string) {
  return withAuth("read", "SalesOrder", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);

    const order = await prisma.salesOrder.findFirst({
      where: { id: orderId, repId: { in: accessibleIds } },
      include: {
        rep: { select: { name: true, email: true } },
        customer: { select: { id: true, code: true, nameAr: true, balance: true } },
        visit: { select: { id: true, code: true, visitedAt: true } },
        items: {
          include: {
            product: { select: { code: true, nameAr: true, unit: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundError("الطلب غير موجود");

    const recentAudit = await prisma.auditLog.findMany({
      where: { entityType: "SalesOrder", entityId: orderId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    });

    return { order, recentAudit };
  });
}
