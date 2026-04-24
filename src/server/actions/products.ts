"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withAuth } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { ActionResult } from "@/types";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const productSchema = z.object({
  code: z.string().min(1, "الكود مطلوب").max(50).trim(),
  nameAr: z.string().min(2, "الاسم العربي مطلوب").max(200).trim(),
  nameEn: z.string().max(200).trim().optional().or(z.literal("")),
  description: z.string().max(2000).trim().optional().or(z.literal("")),
  unit: z.string().min(1, "الوحدة مطلوبة").max(50).trim(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "السعر غير صالح")
    .refine((v) => parseFloat(v) >= 0, "السعر لا يمكن أن يكون سالباً"),
  isActive: z.boolean().optional().default(true),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return withAuth("create", "Product", async (currentUser) => {
    const raw = {
      code: formData.get("code"),
      nameAr: formData.get("nameAr"),
      nameEn: formData.get("nameEn") || undefined,
      description: formData.get("description") || undefined,
      unit: formData.get("unit"),
      price: formData.get("price"),
      isActive: formData.get("isActive") !== "false",
    };

    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    const existing = await prisma.product.findUnique({ where: { code: data.code } });
    if (existing) {
      return { success: false, error: "كود المنتج مستخدم بالفعل" };
    }

    const product = await prisma.product.create({
      data: {
        code: data.code,
        nameAr: data.nameAr,
        nameEn: data.nameEn || null,
        description: data.description || null,
        unit: data.unit,
        price: data.price,
        isActive: data.isActive,
      },
    });

    await audit({
      action: "create_product",
      entityType: "Product",
      entityId: product.id,
      metadata: { code: product.code, nameAr: product.nameAr },
      user: currentUser,
    });

    revalidatePath("/ar/products");
    return { success: true, data: { id: product.id } };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر إنشاء المنتج",
  }));
}

export async function updateProduct(
  productId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withAuth("update", "Product", async (currentUser) => {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) throw new NotFoundError("المنتج غير موجود");

    const raw = {
      code: formData.get("code"),
      nameAr: formData.get("nameAr"),
      nameEn: formData.get("nameEn") || undefined,
      description: formData.get("description") || undefined,
      unit: formData.get("unit"),
      price: formData.get("price"),
      isActive: formData.get("isActive") !== "false",
    };

    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    // Check code uniqueness only if changed
    if (data.code !== existing.code) {
      const codeConflict = await prisma.product.findUnique({ where: { code: data.code } });
      if (codeConflict) return { success: false, error: "كود المنتج مستخدم بالفعل" };
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        code: data.code,
        nameAr: data.nameAr,
        nameEn: data.nameEn || null,
        description: data.description || null,
        unit: data.unit,
        price: data.price,
        isActive: data.isActive,
      },
    });

    await audit({
      action: "update_product",
      entityType: "Product",
      entityId: productId,
      metadata: { code: data.code },
      user: currentUser,
    });

    revalidatePath("/ar/products");
    revalidatePath(`/ar/products/${productId}/edit`);
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تحديث المنتج",
  }));
}

export async function toggleProductStatus(productId: string): Promise<ActionResult> {
  return withAuth("update", "Product", async (currentUser) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError("المنتج غير موجود");

    await prisma.product.update({
      where: { id: productId },
      data: { isActive: !product.isActive },
    });

    await audit({
      action: product.isActive ? "deactivate_product" : "activate_product",
      entityType: "Product",
      entityId: productId,
      user: currentUser,
    });

    revalidatePath("/ar/products");
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر تغيير حالة المنتج",
  }));
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  return withAuth("delete", "Product", async (currentUser) => {
    if (currentUser.role !== "admin") throw new ForbiddenError("حذف المنتجات للمدير فقط");

    await prisma.product.delete({ where: { id: productId } });

    await audit({
      action: "delete_product",
      entityType: "Product",
      entityId: productId,
      user: currentUser,
    });

    revalidatePath("/ar/products");
    return { success: true };
  }).catch((err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : "تعذر حذف المنتج",
  }));
}

export async function searchProducts(q: string): Promise<{ id: string; nameAr: string; code: string; unit: string; price: string }[]> {
  return withAuth("read", "Product", async () => {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(q.trim()
          ? {
              OR: [
                { nameAr: { contains: q, mode: "insensitive" as const } },
                { code: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: { id: true, nameAr: true, code: true, unit: true, price: true },
      orderBy: { nameAr: "asc" },
      take: 30,
    });
    return products.map((p) => ({
      id: p.id,
      nameAr: p.nameAr,
      code: p.code,
      unit: p.unit,
      price: p.price.toFixed(2),
    }));
  }) as Promise<{ id: string; nameAr: string; code: string; unit: string; price: string }[]>;
}
