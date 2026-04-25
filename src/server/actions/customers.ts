"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withAuth, getAccessibleUserIds } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { NotFoundError } from "@/lib/errors";
import type { ActionResult } from "@/types";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const customerSchema = z.object({
  nameAr: z.string().min(2, "الاسم العربي مطلوب").max(200).trim(),
  nameEn: z.string().max(200).trim().optional().or(z.literal("")),
  phone: z.string().regex(/^[0-9+\s-]{7,20}$/, "رقم هاتف غير صالح").optional().or(z.literal("")),
  phone2: z.string().regex(/^[0-9+\s-]{7,20}$/, "رقم هاتف غير صالح").optional().or(z.literal("")),
  address: z.string().max(500).trim().optional().or(z.literal("")),
  notes: z.string().max(2000).trim().optional().or(z.literal("")),
  openingBalance: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "الرصيد الافتتاحي غير صالح")
    .optional()
    .default("0"),
  creditLimit: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "حد الائتمان غير صالح")
    .optional()
    .or(z.literal("")),
  regionId: z.string().cuid().optional().or(z.literal("")),
  assignedToId: z.string().cuid().optional().or(z.literal("")),
  teamId: z.string().cuid().optional().or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

const updateCustomerSchema = customerSchema.omit({ openingBalance: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateCustomerCode(): Promise<string> {
  const count = await prisma.customer.count();
  return `CUS-${String(count + 1).padStart(4, "0")}`;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createCustomer(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return withAuth("create", "Customer", async (currentUser) => {
    const raw = {
      nameAr: formData.get("nameAr"),
      nameEn: formData.get("nameEn") || undefined,
      phone: formData.get("phone") || undefined,
      phone2: formData.get("phone2") || undefined,
      address: formData.get("address") || undefined,
      notes: formData.get("notes") || undefined,
      openingBalance: formData.get("openingBalance") || "0",
      creditLimit: formData.get("creditLimit") || undefined,
      regionId: (formData.get("regionId") === "none" ? "" : formData.get("regionId") as string) || undefined,
      assignedToId: (formData.get("assignedToId") === "none" ? "" : formData.get("assignedToId") as string) || undefined,
      teamId: (formData.get("teamId") === "none" ? "" : formData.get("teamId") as string) || undefined,
      isActive: formData.get("isActive") !== "false",
    };

    const parsed = customerSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;
    const code = await generateCustomerCode();
    const openingBalance = new Prisma.Decimal(data.openingBalance);

    const customer = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          code,
          nameAr: data.nameAr,
          nameEn: data.nameEn || null,
          phone: data.phone || null,
          phone2: data.phone2 || null,
          address: data.address || null,
          notes: data.notes || null,
          openingBalance,
          balance: openingBalance,
          creditLimit: data.creditLimit ? new Prisma.Decimal(data.creditLimit) : null,
          regionId: data.regionId || null,
          assignedToId: data.assignedToId || null,
          teamId: data.teamId || null,
          isActive: data.isActive,
        },
      });

      // Create opening balance transaction if > 0
      if (!openingBalance.isZero()) {
        await tx.customerTransaction.create({
          data: {
            customerId: c.id,
            type: "opening_balance",
            amount: openingBalance,
            balance: openingBalance,
            description: "رصيد افتتاحي",
            createdById: currentUser.id,
          },
        });
      }

      return c;
    });

    await audit({
      action: "create_customer",
      entityType: "Customer",
      entityId: customer.id,
      metadata: { code, nameAr: customer.nameAr, openingBalance: openingBalance.toFixed(2) },
      user: currentUser,
    });

    revalidatePath("/ar/customers");
    return { success: true, data: { id: customer.id } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إنشاء العميل",
  }));
}

export async function updateCustomer(
  customerId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withAuth("update", "Customer", async (currentUser) => {
    const existing = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!existing) throw new NotFoundError("العميل غير موجود");

    const raw = {
      nameAr: formData.get("nameAr"),
      nameEn: formData.get("nameEn") || undefined,
      phone: formData.get("phone") || undefined,
      phone2: formData.get("phone2") || undefined,
      address: formData.get("address") || undefined,
      notes: formData.get("notes") || undefined,
      creditLimit: formData.get("creditLimit") || undefined,
      regionId: (formData.get("regionId") === "none" ? "" : formData.get("regionId") as string) || undefined,
      assignedToId: (formData.get("assignedToId") === "none" ? "" : formData.get("assignedToId") as string) || undefined,
      teamId: (formData.get("teamId") === "none" ? "" : formData.get("teamId") as string) || undefined,
      isActive: formData.get("isActive") !== "false",
    };

    const parsed = updateCustomerSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        nameAr: data.nameAr,
        nameEn: data.nameEn || null,
        phone: data.phone || null,
        phone2: data.phone2 || null,
        address: data.address || null,
        notes: data.notes || null,
        creditLimit: data.creditLimit ? new Prisma.Decimal(data.creditLimit) : null,
        regionId: data.regionId || null,
        assignedToId: data.assignedToId || null,
        teamId: data.teamId || null,
        isActive: data.isActive,
      },
    });

    await audit({
      action: "update_customer",
      entityType: "Customer",
      entityId: customerId,
      metadata: { nameAr: data.nameAr },
      user: currentUser,
    });

    revalidatePath("/ar/customers");
    revalidatePath(`/ar/customers/${customerId}`);
    revalidatePath(`/ar/customers/${customerId}/edit`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تحديث العميل",
  }));
}

export async function toggleCustomerStatus(customerId: string): Promise<ActionResult> {
  return withAuth("update", "Customer", async (currentUser) => {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundError("العميل غير موجود");

    await prisma.customer.update({
      where: { id: customerId },
      data: { isActive: !customer.isActive },
    });

    await audit({
      action: customer.isActive ? "deactivate_customer" : "activate_customer",
      entityType: "Customer",
      entityId: customerId,
      user: currentUser,
    });

    revalidatePath("/ar/customers");
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تغيير حالة العميل",
  }));
}

export async function addCustomerTransaction(
  customerId: string,
  data: {
    type: "collection" | "adjustment" | "return_credit";
    amount: number;
    description?: string;
    reference?: string;
    transactionDate?: Date;
  }
): Promise<ActionResult<{ id: string }>> {
  return withAuth("update", "Customer", async (currentUser) => {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundError("العميل غير موجود");

    if (data.amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    const amount = new Prisma.Decimal(data.amount);
    // collection & return_credit reduce balance; adjustment increases it
    const delta =
      data.type === "collection" || data.type === "return_credit"
        ? amount.negated()
        : amount;

    const newBalance = customer.balance.add(delta);

    const tx = await prisma.$transaction(async (db) => {
      const t = await db.customerTransaction.create({
        data: {
          customerId,
          type: data.type,
          amount,
          balance: newBalance,
          ...(data.description !== undefined && { description: data.description }),
          ...(data.reference !== undefined && { reference: data.reference }),
          transactionDate: data.transactionDate ?? new Date(),
          createdById: currentUser.id,
        },
      });
      await db.customer.update({
        where: { id: customerId },
        data: { balance: newBalance },
      });
      return t;
    });

    await audit({
      action: "add_customer_transaction",
      entityType: "Customer",
      entityId: customerId,
      metadata: { type: data.type, amount: amount.toFixed(2) },
      user: currentUser,
    });

    revalidatePath(`/ar/customers/${customerId}`);
    return { success: true, data: { id: tx.id } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إضافة الحركة",
  }));
}

export async function searchCustomers(q: string): Promise<{ id: string; nameAr: string; code: string; balance: string }[]> {
  return withAuth("read", "Customer", async (currentUser) => {
    const accessibleIds = await getAccessibleUserIds(currentUser);
    const repScope =
      currentUser.role === "sales_rep"
        ? { assignedToId: currentUser.id }
        : currentUser.role === "team_manager"
        ? { assignedTo: { id: { in: accessibleIds } } }
        : {};

    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        ...repScope,
        ...(q.trim()
          ? {
              OR: [
                { nameAr: { contains: q, mode: "insensitive" as const } },
                { code: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: { id: true, nameAr: true, code: true, balance: true },
      orderBy: { nameAr: "asc" },
      take: 30,
    });
    return customers.map((c) => ({
      id: c.id,
      nameAr: c.nameAr,
      code: c.code,
      balance: c.balance.toFixed(2),
    }));
  }) as Promise<{ id: string; nameAr: string; code: string; balance: string }[]>;
}
