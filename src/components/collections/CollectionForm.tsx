"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { createCollection } from "@/server/actions/collections";
import { searchCustomers } from "@/server/actions/customers";
import { formatSAR, cn } from "@/lib/utils";
import type { ActionResult, PaymentMethod } from "@/types";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; hint?: string }[] = [
  { value: "cash",          label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي",  hint: "رقم الحوالة مطلوب" },
  { value: "check",         label: "شيك",          hint: "رقم الشيك اختياري" },
];

interface CollectionFormProps {
  prefilledCustomerId?: string;
  prefilledCustomerName?: string;
  prefilledVisitId?: string;
}

export function CollectionForm({ prefilledCustomerId, prefilledCustomerName, prefilledVisitId }: CollectionFormProps) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(createCollection, { success: false } as ActionResult<{ id: string; code: string }>);
  const [searchPending, startSearch] = useTransition();

  const [customerId, setCustomerId] = useState(prefilledCustomerId ?? "");
  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>(
    prefilledCustomerId && prefilledCustomerName
      ? [{ value: prefilledCustomerId, label: prefilledCustomerName }]
      : []
  );
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (state.success && state.data) {
      const { id } = state.data as { id: string; code: string };
      toast.success("تم تسجيل التحصيل");
      router.push(`/ar/collections/${id}`);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  function handleCustomerSearch(q: string) {
    startSearch(async () => {
      const results = await searchCustomers(q);
      setCustomerOptions(results.map((c) => ({ value: c.id, label: c.nameAr, sublabel: c.code })));
    });
  }

  return (
    <form action={action} className="space-y-6">
      {/* Hidden fields */}
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="method" value={method} />
      {prefilledVisitId && <input type="hidden" name="visitId" value={prefilledVisitId} />}

      {/* Customer */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">العميل <span className="text-danger-500">*</span></Label>
        <Combobox
          options={customerOptions}
          value={customerId}
          onChange={setCustomerId}
          placeholder="ابحث عن عميل..."
          searchPlaceholder="اسم العميل أو الكود..."
          emptyText={searchPending ? "جاري البحث..." : "لا توجد نتائج"}
          onSearchChange={handleCustomerSearch}
          disabled={!!prefilledCustomerId}
        />
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">المبلغ <span className="text-danger-500">*</span></Label>
        <div className="relative">
          <Input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="num ps-20"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">ر.س</span>
        </div>
        {amount && parseFloat(amount) > 0 && (
          <p className="text-xs text-text-muted">{formatSAR(amount)}</p>
        )}
      </div>

      {/* Payment method */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">طريقة الدفع <span className="text-danger-500">*</span></Label>
        <div className="grid grid-cols-3 gap-3">
          {PAYMENT_METHODS.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMethod(value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                method === value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-border bg-surface-0 text-text-secondary hover:border-brand-300"
              )}
            >
              <span className="text-sm font-semibold">{label}</span>
              {hint && <span className="text-xs text-text-muted hidden sm:block">{hint}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Reference — required for bank_transfer, optional for check */}
      {(method === "bank_transfer" || method === "check") && (
        <div className="space-y-2">
          <Label className="text-base font-semibold">
            {method === "bank_transfer" ? "رقم الحوالة" : "رقم الشيك"}
            {method === "bank_transfer" && <span className="text-danger-500"> *</span>}
          </Label>
          <Input
            name="reference"
            placeholder={method === "bank_transfer" ? "أدخل رقم الحوالة..." : "أدخل رقم الشيك (اختياري)..."}
            required={method === "bank_transfer"}
          />
        </div>
      )}

      {/* Date */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">تاريخ التحصيل</Label>
        <Input
          name="collectedAt"
          type="datetime-local"
          defaultValue={new Date().toISOString().slice(0, 16)}
          className="num"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">ملاحظات</Label>
        <Textarea name="notes" placeholder="ملاحظات إضافية..." rows={2} />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full text-base"
        disabled={isPending || !customerId || !amount}
      >
        {isPending ? <Loader2 size={18} className="animate-spin" /> : null}
        تسجيل التحصيل
      </Button>
    </form>
  );
}
