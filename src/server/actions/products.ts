"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withAuth } from "@/lib/rbac/access";
import { audit } from "@/lib/audit/logger";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { ActionResult } from "@/types";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const productSchema = z.object({
  code: z.string().max(50).trim().optional().or(z.literal("")),
  nameAr: z.string().min(2, "الاسم العربي مطلوب").max(200).trim(),
  nameEn: z.string().max(200).trim().optional().or(z.literal("")),
  description: z.string().max(2000).trim().optional().or(z.literal("")),
  unit: z.string().min(1, "الوحدة مطلوبة").max(50).trim(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "السعر غير صالح")
    .refine((v) => parseFloat(v) >= 0, "السعر لا يمكن أن يكون سالباً")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateProductCode(): Promise<string> {
  const count = await prisma.product.count();
  return `PRD-${String(count + 1).padStart(4, "0")}`;
}

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
      price: formData.get("price") || undefined,
      isActive: formData.get("isActive") !== "false",
    };

    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    // Auto-generate code if not provided
    const code = (data.code && data.code.trim())
      ? data.code.trim()
      : await generateProductCode();

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) {
      return {
        success: false,
        error: data.code ? "كود المنتج مستخدم بالفعل" : "حدث تعارض في الكود التلقائي. يرجى إدخاله يدوياً.",
      };
    }

    const product = await prisma.product.create({
      data: {
        code,
        nameAr: data.nameAr,
        nameEn: data.nameEn || null,
        description: data.description || null,
        unit: data.unit,
        price: data.price || "0",
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
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    return { success: false, error: err instanceof Error ? err.message : "تعذر إنشاء المنتج" };
  });
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
      price: formData.get("price") || undefined,
      isActive: formData.get("isActive") !== "false",
    };

    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { success: false, error: firstError?.message ?? "بيانات غير صالحة" };
    }

    const data = parsed.data;

    // Keep existing code if user left the field empty
    const code = (data.code && data.code.trim()) ? data.code.trim() : existing.code;

    // Check code uniqueness only if changed
    if (code !== existing.code) {
      const codeConflict = await prisma.product.findUnique({ where: { code } });
      if (codeConflict) return { success: false, error: "كود المنتج مستخدم بالفعل" };
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        code,
        nameAr: data.nameAr,
        nameEn: data.nameEn || null,
        description: data.description || null,
        unit: data.unit,
        price: data.price || "0",
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
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    return { success: false, error: err instanceof Error ? err.message : "تعذر تحديث المنتج" };
  });
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
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    return { success: false, error: err instanceof Error ? err.message : "تعذر تغيير حالة المنتج" };
  });
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
  }).catch((err: unknown) => {
    if (isRedirectError(err)) throw err;
    return { success: false, error: err instanceof Error ? err.message : "تعذر حذف المنتج" };
  });
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
