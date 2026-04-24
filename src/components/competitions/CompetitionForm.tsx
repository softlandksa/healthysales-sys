"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { createCompetition } from "@/server/actions/competitions";
import { searchProducts } from "@/server/actions/products";
import type { ActionResult } from "@/types";

export function CompetitionForm() {
  const router = useRouter();
  const [state, action, isPending] = useActionState(
    createCompetition,
    { success: false } as ActionResult<{ id: string }>
  );
  const [productId, setProductId]         = useState("");
  const [productOptions, setProductOptions] = useState<ComboboxOption[]>([]);

  useEffect(() => {
    if (state.success && state.data) {
      toast.success("تم إنشاء المسابقة");
      router.push(`/ar/competitions/${state.data.id}`);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

  async function handleProductSearch(q: string) {
    if (q.length < 2) return;
    const results = await searchProducts(q);
    setProductOptions(
      results.map((p) => ({
        value:    p.id,
        label:    p.nameAr,
        sublabel: `${p.code} — ${p.unit}`,
      }))
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="productId" value={productId} />

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-semibold">
          اسم المسابقة <span className="text-danger-500">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="مثال: مسابقة زيت الزيتون — مايو 2025"
          maxLength={120}
          required
        />
      </div>

      {/* Product */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          المنتج <span className="text-danger-500">*</span>
        </Label>
        <Combobox
          options={productOptions}
          value={productId}
          onChange={setProductId}
          onSearchChange={handleProductSearch}
          placeholder="ابحث عن المنتج..."
          searchPlaceholder="اكتب اسم أو كود المنتج..."
          emptyText="لا توجد نتائج — اكتب للبحث"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-sm font-semibold">
            تاريخ البدء <span className="text-danger-500">*</span>
          </Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            min={todayStr}
            required
            className="num"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-sm font-semibold">
            تاريخ الانتهاء <span className="text-danger-500">*</span>
          </Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            min={todayStr}
            required
            className="num"
          />
        </div>
      </div>

      {/* Prize */}
      <div className="space-y-2">
        <Label htmlFor="prize" className="text-sm font-semibold">
          الجائزة <span className="text-danger-500">*</span>
        </Label>
        <Input
          id="prize"
          name="prize"
          placeholder="مثال: بونس 500 ر.س للمركز الأول"
          maxLength={300}
          required
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-semibold">ملاحظات</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="شروط وأحكام إضافية، ملاحظات للمندوبين..."
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending || !productId}
          className="flex-1 sm:flex-none sm:min-w-36"
        >
          {isPending && <Loader2 size={15} className="animate-spin" />}
          إنشاء المسابقة
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
