"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createProduct, updateProduct } from "@/server/actions/products";
import type { ActionResult } from "@/types";

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  defaultValues?: {
    code?: string;
    nameAr?: string;
    nameEn?: string;
    description?: string;
    unit?: string;
    price?: string;
    isActive?: boolean;
  };
  units: string[];
}

const INITIAL: ActionResult = { success: false };

const FALLBACK_UNITS = ["قطعة", "كرتون", "كيلو", "لتر", "متر", "علبة", "طرد", "دستة"];

export function ProductForm({ mode, productId, defaultValues, units }: ProductFormProps) {
  const router = useRouter();

  const availableUnits = units.length > 0 ? units : FALLBACK_UNITS;
  const defaultUnit    = defaultValues?.unit ?? availableUnits[0] ?? "قطعة";

  const action =
    mode === "create"
      ? createProduct
      : (prev: ActionResult, formData: FormData) =>
          updateProduct(productId!, prev, formData);

  const [state, formAction, isPending] = useActionState(
    action as (prev: ActionResult, formData: FormData) => Promise<ActionResult>,
    INITIAL
  );

  useEffect(() => {
    if (state.success) {
      toast.success(mode === "create" ? "تم إنشاء المنتج" : "تم حفظ التغييرات");
      router.push("/ar/products");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, mode, router]);

  return (
    <form action={formAction}>
      <div className="card p-6 space-y-5 max-w-2xl">
        <h3 className="font-semibold text-text-primary">بيانات المنتج</h3>
        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="code" required>كود المنتج</Label>
            <Input
              id="code"
              name="code"
              dir="ltr"
              defaultValue={defaultValues?.code ?? ""}
              placeholder="PRD-0001"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unit" required>الوحدة</Label>
            <Select name="unit" defaultValue={defaultUnit} required>
              <SelectTrigger id="unit">
                <SelectValue placeholder="اختر الوحدة" />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nameAr" required>اسم المنتج (عربي)</Label>
          <Input
            id="nameAr"
            name="nameAr"
            defaultValue={defaultValues?.nameAr ?? ""}
            placeholder="مثال: زيت زيتون بكر ممتاز"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nameEn">اسم المنتج (إنجليزي)</Label>
          <Input
            id="nameEn"
            name="nameEn"
            dir="ltr"
            defaultValue={defaultValues?.nameEn ?? ""}
            placeholder="Extra Virgin Olive Oil"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="price">السعر (ر.س)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            dir="ltr"
            defaultValue={defaultValues?.price ?? ""}
            placeholder="0.00"
          />
          <p className="text-xs text-text-muted">اتركه فارغاً إذا لم يُحدَّد سعر بعد</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">الوصف</Label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={defaultValues?.description ?? ""}
            placeholder="وصف المنتج..."
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
          <Label htmlFor="isActive" className="cursor-pointer">منتج نشط</Label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/ar/products")}
            disabled={isPending}
          >
            إلغاء
          </Button>
          <Button type="submit" loading={isPending}>
            {mode === "create" ? "إنشاء المنتج" : "حفظ التغييرات"}
          </Button>
        </div>
      </div>
    </form>
  );
}
