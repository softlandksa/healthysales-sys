"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, ShoppingCart, Wallet, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { createVisit } from "@/server/actions/visits";
import { searchCustomers } from "@/server/actions/customers";
import { cn } from "@/lib/utils";
import type { VisitType } from "@/types";
import type { ActionResult } from "@/types";

const VISIT_TYPES: { value: VisitType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "visit_only", label: "زيارة",   icon: MapPin,        description: "زيارة بدون معاملة" },
  { value: "sale",       label: "بيع",     icon: ShoppingCart,  description: "إنشاء طلب بيع" },
  { value: "collection", label: "تحصيل",   icon: Wallet,        description: "تسجيل دفعة" },
];

interface VisitFormProps {
  prefilledCustomerId?: string;
  prefilledCustomerName?: string;
}

export function VisitForm({ prefilledCustomerId, prefilledCustomerName }: VisitFormProps) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(createVisit, { success: false } as ActionResult<{ id: string; visitType: VisitType }>);
  const [searchPending, startSearch] = useTransition();

  const [customerId, setCustomerId] = useState(prefilledCustomerId ?? "");
  const [visitType, setVisitType] = useState<VisitType>("visit_only");
  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>(
    prefilledCustomerId && prefilledCustomerName
      ? [{ value: prefilledCustomerId, label: prefilledCustomerName }]
      : []
  );
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "done" | "denied">("idle");
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  // Capture geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latRef.current) latRef.current.value = String(pos.coords.latitude);
        if (lngRef.current) lngRef.current.value = String(pos.coords.longitude);
        setGeoStatus("done");
      },
      () => setGeoStatus("denied"),
      { timeout: 5000, maximumAge: 60000 }
    );
  }, []);

  // Handle success
  useEffect(() => {
    if (!state.success || !state.data) return;
    const { id, visitType: vt } = state.data as { id: string; visitType: VisitType };
    if (vt === "sale") {
      router.push(`/ar/sales/new?visitId=${id}&customerId=${customerId}`);
    } else if (vt === "collection") {
      router.push(`/ar/collections/new?visitId=${id}&customerId=${customerId}`);
    } else {
      toast.success("تم تسجيل الزيارة");
      router.push("/ar/visits");
    }
  }, [state, customerId, router]);

  // Handle error
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  function handleCustomerSearch(q: string) {
    startSearch(async () => {
      const results = await searchCustomers(q);
      setCustomerOptions(
        results.map((c) => ({ value: c.id, label: c.nameAr, sublabel: c.code }))
      );
    });
  }

  return (
    <form action={action} className="space-y-6">
      {/* Hidden fields */}
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="visitType" value={visitType} />
      <input type="hidden" name="latitude" ref={latRef} />
      <input type="hidden" name="longitude" ref={lngRef} />

      {/* Customer */}
      <div className="space-y-2">
        <Label htmlFor="customer-combo" className="text-base font-semibold">
          العميل <span className="text-danger-500">*</span>
        </Label>
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

      {/* Visit type pills */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">نوع الزيارة <span className="text-danger-500">*</span></Label>
        <div className="grid grid-cols-3 gap-3">
          {VISIT_TYPES.map(({ value, label, icon: Icon, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => setVisitType(value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                visitType === value
                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
                  : "border-border bg-surface-0 text-text-secondary hover:border-brand-300 hover:bg-surface-1"
              )}
            >
              <Icon size={28} className={visitType === value ? "text-brand-600" : "text-text-muted"} />
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-text-muted hidden sm:block">{description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-base font-semibold">ملاحظات</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="أي ملاحظات إضافية..."
          rows={3}
        />
      </div>

      {/* Geo indicator */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Navigation
          size={13}
          className={cn(
            geoStatus === "done" && "text-success-600",
            geoStatus === "denied" && "text-danger-400",
            geoStatus === "loading" && "animate-pulse text-brand-400"
          )}
        />
        {geoStatus === "loading" && "جاري تحديد الموقع..."}
        {geoStatus === "done" && "تم تحديد الموقع"}
        {geoStatus === "denied" && "الموقع غير متاح"}
        {geoStatus === "idle" && "الموقع الجغرافي"}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full text-base"
        disabled={isPending || !customerId}
      >
        {isPending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            جاري الحفظ...
          </>
        ) : (
          <>
            {visitType === "visit_only" && <MapPin size={18} />}
            {visitType === "sale" && <ShoppingCart size={18} />}
            {visitType === "collection" && <Wallet size={18} />}
            {visitType === "visit_only" ? "تسجيل الزيارة" : visitType === "sale" ? "الانتقال لطلب البيع" : "الانتقال للتحصيل"}
          </>
        )}
      </Button>
    </form>
  );
}
