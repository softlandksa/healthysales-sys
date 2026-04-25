"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { audit } from "@/lib/audit/logger";
import type { ActionResult } from "@/types";

// ─── General settings ─────────────────────────────────────────────────────────

const ALLOWED_KEYS = [
  "company_name",
  "company_phone",
  "company_email",
  "currency_label",
  "fiscal_year_start",
  "max_discount_pct",
] as const;

type SettingKey = (typeof ALLOWED_KEYS)[number];

export interface SystemSettings {
  company_name: string;
  company_phone: string;
  company_email: string;
  currency_label: string;
  fiscal_year_start: string;
  max_discount_pct: string;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [...ALLOWED_KEYS] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    company_name:       map.company_name       ?? "نظام المبيعات الميداني",
    company_phone:      map.company_phone      ?? "",
    company_email:      map.company_email      ?? "",
    currency_label:     map.currency_label     ?? "ر.س",
    fiscal_year_start:  map.fiscal_year_start  ?? "01-01",
    max_discount_pct:   map.max_discount_pct   ?? "20",
  };
}

const saveSettingsSchema = z.object({
  company_name:      z.string().min(2, "اسم الشركة مطلوب").max(200),
  company_phone:     z.string().max(30).optional().or(z.literal("")),
  company_email:     z.string().email("بريد إلكتروني غير صالح").optional().or(z.literal("")),
  currency_label:    z.string().min(1, "رمز العملة مطلوب").max(10),
  fiscal_year_start: z.string().regex(/^\d{2}-\d{2}$/, "صيغة التاريخ: يوم-شهر (مثال: 01-01)"),
  max_discount_pct:  z.string().regex(/^\d{1,3}$/, "نسبة مئوية صحيحة مطلوبة"),
});

export async function saveSystemSettings(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const ability = defineAbilitiesFor(user);
  if (!ability.can("manage", "all")) {
    return { success: false, error: "الصلاحية غير كافية — يلزم دور المسؤول" };
  }

  const raw = Object.fromEntries(ALLOWED_KEYS.map((k) => [k, formData.get(k) ?? ""]));
  const parsed = saveSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "بيانات غير صالحة";
    return { success: false, error: msg };
  }

  const entries = Object.entries(parsed.data) as [SettingKey, string][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    )
  );

  await audit({ action: "update", entityType: "Setting", user });
  revalidatePath("/ar/settings");
  return { success: true };
}

// ─── Regions ──────────────────────────────────────────────────────────────────

const regionSchema = z.object({
  nameAr: z.string().min(2, "الاسم بالعربي مطلوب (حرفان على الأقل)").max(100),
  nameEn: z.string().min(1, "الاسم بالإنجليزي مطلوب").max(100),
});

export async function createRegion(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const ability = defineAbilitiesFor(user);
  if (!ability.can("manage", "all")) {
    return { success: false, error: "الصلاحية غير كافية" };
  }

  const parsed = regionSchema.safeParse({
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }

  try {
    const region = await prisma.region.create({ data: parsed.data });
    await audit({ action: "create", entityType: "Region", entityId: region.id, user });
    revalidatePath("/ar/settings");
    return { success: true, data: { id: region.id } };
  } catch {
    return { success: false, error: "حدث خطأ أثناء الحفظ" };
  }
}

export async function updateRegion(
  id: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const ability = defineAbilitiesFor(user);
  if (!ability.can("manage", "all")) {
    return { success: false, error: "الصلاحية غير كافية" };
  }

  const parsed = regionSchema.safeParse({
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }

  try {
    await prisma.region.update({ where: { id }, data: parsed.data });
    await audit({ action: "update", entityType: "Region", entityId: id, user });
    revalidatePath("/ar/settings");
    return { success: true };
  } catch {
    return { success: false, error: "حدث خطأ أثناء الحفظ" };
  }
}

export async function deleteRegion(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const ability = defineAbilitiesFor(user);
  if (!ability.can("manage", "all")) {
    return { success: false, error: "الصلاحية غير كافية" };
  }

  try {
    await prisma.region.delete({ where: { id } });
    await audit({ action: "delete", entityType: "Region", entityId: id, user });
    revalidatePath("/ar/settings");
    return { success: true };
  } catch {
    return { success: false, error: "لا يمكن حذف المنطقة — قد تكون مرتبطة بعملاء" };
  }
}

// ─── Account (current user profile) ──────────────────────────────────────────

const updateProfileSchema = z.object({
  name:  z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(100),
  phone: z.string().regex(/^[0-9+\s-]{7,20}$/, "رقم هاتف غير صالح").optional().or(z.literal("")),
});

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
  newPassword:     z.string().min(6, "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"),
});

import bcrypt from "bcryptjs";

export async function updateProfile(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse({
    name:  formData.get("name"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name:  parsed.data.name,
        phone: parsed.data.phone || null,
      },
    });
    revalidatePath("/ar/settings");
    return { success: true };
  } catch {
    return { success: false, error: "حدث خطأ أثناء الحفظ" };
  }
}

export async function changeOwnPassword(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = changeOwnPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword:     formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } });
  if (!dbUser?.password) {
    return { success: false, error: "لا يمكن تغيير كلمة المرور لهذا الحساب" };
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, dbUser.password);
  if (!ok) {
    return { success: false, error: "كلمة المرور الحالية غير صحيحة" };
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  return { success: true };
}
