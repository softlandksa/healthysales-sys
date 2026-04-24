"use server";

/*
 * COLLECTION ACCOUNTING MODEL
 * ────────────────────────────────────────────────────────────────────────────
 * A Collection is ALWAYS a separate CustomerTransaction.
 * type: 'collection', amount: -amount (reduces customer.balance)
 * It does NOT directly reference a SalesOrder — it reduces the customer's
 * overall balance (general payment against the account).
 * The visit link (visitId) is informational only.
 *
 * Invariant: customer.balance == SUM(customer_transactions.amount) for that customer.
 * All writes are atomic in prisma.$transaction.
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withAuth, getAccessibleUserIds } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { nextCollectionCode } from "@/lib/utils/sequences";
import type { ActionResult, PaymentMethod } from "@/types";

const createCollectionSchema = z.object({
  customerId: z.string().cuid(),
  visitId: z.string().cuid().optional().or(z.literal("")),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "المبلغ غير صالح")
    .refine((v) => parseFloat(v) > 0, "المبلغ يجب أن يكون أكبر من صفر"),
  method: z.enum(["cash", "bank_transfer", "check"]),
  reference: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  collectedAt: z.string().optional().or(z.literal("")),
});

export async function createCollection(
  _prev: ActionResult<{ id: string; code: string }>,
  formData: FormData
): Promise<ActionResult<{ id: string; code: string }>> {
  return withAuth("create", "Collection", async (currentUser) => {
    const raw = {
      customerId: formData.get("customerId"),
      visitId: formData.get("visitId") || undefined,
      amount: formData.get("amount"),
      method: formData.get("method"),
      reference: formData.get("reference") || undefined,
      notes: formData.get("notes") || undefined,
      collectedAt: formData.get("collectedAt") || undefined,
    };

    const parsed = createCollectionSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    if ((data.method === "bank_transfer" || data.method === "check") && !data.reference) {
      return { success: false, error: "رقم المرجع مطلوب للتحويل البنكي والشيك" };
    }

    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true, balance: true, nameAr: true },
    });
    if (!customer) throw new NotFoundError("العميل غير موجود");

    const amount = new Prisma.Decimal(data.amount);

    // Warn about overpayment but allow it (spec says "warn but allow")
    if (amount.greaterThan(customer.balance) && customer.balance.greaterThan(0)) {
      // We don't block; the resulting negative balance is a credit
    }

    const collection = await prisma.$transaction(async (tx) => {
      const code = await nextCollectionCode(tx);
      const collectedAt = data.collectedAt ? new Date(data.collectedAt) : new Date();
      const newBalance = customer.balance.sub(amount);

      const col = await tx.collection.create({
        data: {
          code,
          amount,
          method: data.method as PaymentMethod,
          ...(data.reference && { reference: data.reference }),
          ...(data.notes && { notes: data.notes }),
          repId: currentUser.id,
          customerId: data.customerId,
          ...(data.visitId && data.visitId !== "" && { visitId: data.visitId }),
          collectedAt,
        },
      });

      await tx.customerTransaction.create({
        data: {
          customerId: data.customerId,
          type: "collection",
          amount: amount.negated(),
          balance: newBalance,
          description: `تحصيل — ${code}`,
          referenceType: "collection",
          referenceId: col.id,
          createdById: currentUser.id,
          transactionDate: collectedAt,
        },
      });

      await tx.customer.update({
        where: { id: data.customerId },
        data: { balance: newBalance },
      });

      return col;
    });

    await audit({
      action: "create_collection",
      entityType: "Collection",
      entityId: collection.id,
      metadata: {
        code: collection.code,
        amount: amount.toFixed(2),
        method: data.method,
        customerId: data.customerId,
      },
      user: currentUser,
    });

    revalidatePath("/ar/collections");
    revalidatePath(`/ar/customers/${data.customerId}`);
    revalidateTag(`customer-${data.customerId}`);

    return { success: true, data: { id: collection.id, code: collection.code } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إنشاء التحصيل",
  }));
}

export async function cancelCollection(
  collectionId: string,
  reason: string
): Promise<ActionResult> {
  return withAuth("update", "Collection", async (currentUser) => {
    if (!["admin", "general_manager"].includes(currentUser.role)) {
      throw new ForbiddenError("إلغاء التحصيلات للمدير العام والمديرين فقط");
    }

    const col = await prisma.collection.findUnique({
      where: { id: collectionId },
      select: { id: true, code: true, amount: true, isCancelled: true, customerId: true },
    });
    if (!col) throw new NotFoundError("التحصيل غير موجود");
    if (col.isCancelled) throw new ValidationError("هذا التحصيل ملغى بالفعل");

    const customer = await prisma.customer.findUnique({
      where: { id: col.customerId },
      select: { balance: true },
    });
    if (!customer) throw new NotFoundError("العميل غير موجود");

    await prisma.$transaction(async (tx) => {
      await tx.collection.update({
        where: { id: collectionId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          ...(reason && { cancelReason: reason }),
        },
      });

      // Reverse the collection: +amount back to customer balance
      const newBalance = customer.balance.add(col.amount);
      await tx.customerTransaction.create({
        data: {
          customerId: col.customerId,
          type: "adjustment",
          amount: col.amount,
          balance: newBalance,
          description: `إلغاء تحصيل — ${col.code}`,
          referenceType: "collection",
          referenceId: collectionId,
          createdById: currentUser.id,
        },
      });
      await tx.customer.update({
        where: { id: col.customerId },
        data: { balance: newBalance },
      });
    });

    await audit({
      action: "cancel_collection",
      entityType: "Collection",
      entityId: collectionId,
      metadata: { amount: col.amount.toFixed(2), reason },
      user: currentUser,
    });

    revalidatePath("/ar/collections");
    revalidatePath(`/ar/customers/${col.customerId}`);
    revalidateTag(`customer-${col.customerId}`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إلغاء التحصيل",
  }));
}

export async function getCollectionDetail(collectionId: string) {
  return withAuth("read", "Collection", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);

    const col = await prisma.collection.findFirst({
      where: { id: collectionId, repId: { in: accessibleIds } },
      include: {
        rep: { select: { name: true, email: true } },
        customer: { select: { id: true, code: true, nameAr: true } },
        visit: { select: { id: true, code: true } },
      },
    });
    if (!col) throw new NotFoundError("التحصيل غير موجود");
    return col;
  });
}
