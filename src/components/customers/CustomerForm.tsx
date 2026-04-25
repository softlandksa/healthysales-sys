"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { createCustomer, updateCustomer } from "@/server/actions/customers";
import type { ActionResult, UserRole } from "@/types";

interface RepOption { id: string; name: string | null; email: string; role: UserRole }
interface TeamOption { id: string; nameAr: string }
interface RegionOption { id: string; nameAr: string }

interface CustomerFormProps {
  mode: "create" | "edit";
  customerId?: string;
  defaultValues?: {
    nameAr?: string;
    nameEn?: string;
    phone?: string;
    phone2?: string;
    address?: string;
    notes?: string;
    openingBalance?: string;
    creditLimit?: string;
    regionId?: string;
    assignedToId?: string;
    teamId?: string;
    isActive?: boolean;
  };
  reps: RepOption[];
  teams: TeamOption[];
  regions: RegionOption[];
}

const INITIAL: ActionResult = { success: false };

export function CustomerForm({
  mode,
  customerId,
  defaultValues,
  reps,
  teams,
  regions,
}: CustomerFormProps) {
  const router = useRouter();

  const action =
    mode === "create"
      ? createCustomer
      : (prev: ActionResult, formData: FormData) =>
          updateCustomer(customerId!, prev, formData);

  const [state, formAction, isPending] = useActionState(
    action as (prev: ActionResult, formData: FormData) => Promise<ActionResult>,
    INITIAL
  );

  useEffect(() => {
    if (state.success) {
      toast.success(mode === "create" ? "تم إنشاء العميل" : "تم حفظ التغييرات");
      router.push("/ar/customers");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, mode, router]);

  return (
    <form action={formAction}>
      <div className="space-y-5 max-w-2xl">
        {/* Basic info */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-text-primary">البيانات الأساسية</h3>
          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="nameAr" required>اسم العميل (عربي)</Label>
            <Input
              id="nameAr"
              name="nameAr"
              defaultValue={defaultValues?.nameAr ?? ""}
              placeholder="شركة الأمل للتجارة"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nameEn">اسم العميل (إنجليزي)</Label>
            <Input
              id="nameEn"
              name="nameEn"
              dir="ltr"
              defaultValue={defaultValues?.nameEn ?? ""}
              placeholder="Al Amal Trading Co."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">هاتف</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                dir="ltr"
                defaultValue={defaultValues?.phone ?? ""}
                placeholder="05xxxxxxxx"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone2">هاتف 2</Label>
              <Input
                id="phone2"
                name="phone2"
                type="tel"
                dir="ltr"
                defaultValue={defaultValues?.phone2 ?? ""}
                placeholder="05xxxxxxxx"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">العنوان</Label>
            <Input
              id="address"
              name="address"
              defaultValue={defaultValues?.address ?? ""}
              placeholder="الرياض، حي العليا، شارع الملك فهد"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="regionId">المنطقة</Label>
            <Select name="regionId" defaultValue={defaultValues?.regionId ?? "none"}>
              <SelectTrigger id="regionId">
                <SelectValue placeholder="اختر المنطقة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون تحديد</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nameAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Assignment */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-text-primary">التعيين</h3>
          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="teamId">الفريق</Label>
            <Select name="teamId" defaultValue={defaultValues?.teamId ?? "none"}>
              <SelectTrigger id="teamId">
                <SelectValue placeholder="اختر الفريق" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون فريق</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nameAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assignedToId">المندوب المسؤول</Label>
            <Select name="assignedToId" defaultValue={defaultValues?.assignedToId ?? "none"}>
              <SelectTrigger id="assignedToId">
                <SelectValue placeholder="اختر المندوب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون تحديد</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name ?? r.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Financial */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-text-primary">المالية</h3>
          <Separator />

          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="openingBalance">الرصيد الافتتاحي (ر.س)</Label>
              <Input
                id="openingBalance"
                name="openingBalance"
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                defaultValue={defaultValues?.openingBalance ?? "0"}
                placeholder="0.00"
              />
              <p className="text-xs text-text-muted">
                مبلغ مستحق على العميل قبل بدء العمل في النظام
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="creditLimit">حد الائتمان (ر.س)</Label>
            <Input
              id="creditLimit"
              name="creditLimit"
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              defaultValue={defaultValues?.creditLimit ?? ""}
              placeholder="اتركه فارغاً لعدم التحديد"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">ملاحظات</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={defaultValues?.notes ?? ""}
              placeholder="أي ملاحظات إضافية..."
              className="flex w-full rounded-input border border-border bg-surface-0 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="isActive"
              name="isActive"
              defaultChecked={defaultValues?.isActive ?? true}
              value="true"
            />
            <Label htmlFor="isActive" className="cursor-pointer">عميل نشط</Label>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/ar/customers")}
            disabled={isPending}
          >
            إلغاء
          </Button>
          <Button type="submit" loading={isPending}>
            {mode === "create" ? "إنشاء العميل" : "حفظ التغييرات"}
          </Button>
        </div>
      </div>
    </form>
  );
}
