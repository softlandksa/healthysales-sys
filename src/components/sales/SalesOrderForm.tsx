"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { createSalesOrder } from "@/server/actions/sales";
import { searchCustomers } from "@/server/actions/customers";
import { searchProducts } from "@/server/actions/products";
import { expiryStatus, statusLabel, EXPIRY_STATUS_CLASSES } from "@/lib/utils/expiry";
import { formatSAR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types";

interface OrderItem {
  key: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  expiryDate: string;
}

interface SalesOrderFormProps {
  prefilledCustomerId?: string;
  prefilledCustomerName?: string;
  prefilledVisitId?: string;
}

function newItem(): OrderItem {
  return {
    key: Math.random().toString(36).slice(2),
    productId: "",
    productName: "",
    unit: "",
    quantity: "1",
    unitPrice: "",
    expiryDate: "",
  };
}

export function SalesOrderForm({ prefilledCustomerId, prefilledCustomerName, prefilledVisitId }: SalesOrderFormProps) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(createSalesOrder, { success: false } as ActionResult<{ id: string; code: string }>);
  const [searchPending, startSearch] = useTransition();
  const [productSearchPending, startProductSearch] = useTransition();

  const [customerId, setCustomerId] = useState(prefilledCustomerId ?? "");
  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>(
    prefilledCustomerId && prefilledCustomerName
      ? [{ value: prefilledCustomerId, label: prefilledCustomerName }]
      : []
  );
  const [items, setItems] = useState<OrderItem[]>([newItem()]);
  const [productOptionsMap, setProductOptionsMap] = useState<Record<string, ComboboxOption[]>>({});
  const [discount, setDiscount] = useState("0");
  const [confirmImmediately, setConfirmImmediately] = useState(false);

  useEffect(() => {
    if (state.success && state.data) {
      const { id } = state.data as { id: string; code: string };
      toast.success("تم إنشاء الطلب");
      router.push(`/ar/sales/${id}`);
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

  function handleProductSearch(key: string, q: string) {
    startProductSearch(async () => {
      const results = await searchProducts(q);
      setProductOptionsMap((prev) => ({
        ...prev,
        [key]: results.map((p) => ({ value: p.id, label: p.nameAr, sublabel: `${p.code} — ${p.unit}` })),
      }));
    });
  }

  function handleProductSelect(key: string, productId: string) {
    const opts = productOptionsMap[key] ?? [];
    const found = opts.find((o) => o.value === productId);
    if (!found) return;
    const sublabel = found.sublabel ?? "";
    const unit = sublabel.split(" — ")[1] ?? "";
    setItems((prev) =>
      prev.map((it) =>
        it.key === key ? { ...it, productId, productName: found.label, unit } : it
      )
    );
  }

  function updateItem(key: string, field: keyof OrderItem, value: string) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()]);
  }

  // Compute totals
  const subtotal = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const discountNum = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountNum);

  return (
    <form action={action} className="space-y-6">
      {/* Hidden fields */}
      <input type="hidden" name="customerId" value={customerId} />
      {prefilledVisitId && <input type="hidden" name="visitId" value={prefilledVisitId} />}
      <input type="hidden" name="confirmImmediately" value={String(confirmImmediately)} />
      {items.map((it, i) => (
        <span key={it.key}>
          <input type="hidden" name={`items[${i}].productId`} value={it.productId} />
          <input type="hidden" name={`items[${i}].quantity`} value={it.quantity} />
          <input type="hidden" name={`items[${i}].unitPrice`} value={it.unitPrice} />
          <input type="hidden" name={`items[${i}].expiryDate`} value={it.expiryDate} />
        </span>
      ))}
      <input type="hidden" name="discount" value={discount || "0"} />

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

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">المنتجات <span className="text-danger-500">*</span></Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus size={14} />
            إضافة منتج
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => {
            const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
            const expStatus = expiryDate ? expiryStatus(expiryDate) : null;
            const expClass = expStatus ? EXPIRY_STATUS_CLASSES[expStatus] : "";
            const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);

            return (
              <div key={item.key} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-text-muted font-mono mt-1">#{i + 1}</span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-danger-500 hover:text-danger-700 shrink-0"
                      onClick={() => removeItem(item.key)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs text-text-secondary">المنتج</Label>
                    <Combobox
                      options={productOptionsMap[item.key] ?? []}
                      value={item.productId}
                      onChange={(val) => handleProductSelect(item.key, val)}
                      placeholder="ابحث عن منتج..."
                      searchPlaceholder="اسم المنتج أو الكود..."
                      emptyText={productSearchPending ? "جاري البحث..." : "لا توجد نتائج"}
                      onSearchChange={(q) => handleProductSearch(item.key, q)}
                    />
                    {item.unit && <p className="text-xs text-text-muted">الوحدة: {item.unit}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-text-secondary">الكمية</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
                      className="num"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-text-secondary">السعر</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.key, "unitPrice", e.target.value)}
                      className="num"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs text-text-secondary">
                      تاريخ الانتهاء <span className="text-danger-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={item.expiryDate}
                      onChange={(e) => updateItem(item.key, "expiryDate", e.target.value)}
                      className="num"
                    />
                    {expiryDate && expStatus && (
                      <span className={cn("inline-block text-xs px-2 py-0.5 rounded-full border", expClass)}>
                        {statusLabel(expiryDate)}
                      </span>
                    )}
                  </div>
                </div>

                {lineTotal > 0 && (
                  <div className="text-left rtl:text-right">
                    <span className="text-xs text-text-muted">الإجمالي: </span>
                    <span className="text-sm font-semibold num">{formatSAR(lineTotal)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Discount */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">الخصم</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          className="num max-w-xs"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">ملاحظات</Label>
        <Textarea name="notes" placeholder="ملاحظات إضافية..." rows={2} />
      </div>

      {/* Totals */}
      <div className="card p-4 space-y-2 bg-surface-1">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>المجموع الفرعي</span>
          <span className="num">{formatSAR(subtotal)}</span>
        </div>
        {discountNum > 0 && (
          <div className="flex justify-between text-sm text-text-secondary">
            <span>الخصم</span>
            <span className="num text-danger-600">- {formatSAR(discountNum)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-border pt-2">
          <span>الإجمالي</span>
          <span className="num">{formatSAR(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="flex-1"
          disabled={isPending || !customerId || items.every((it) => !it.productId)}
          onClick={() => setConfirmImmediately(false)}
        >
          {isPending && !confirmImmediately ? <Loader2 size={16} className="animate-spin" /> : null}
          حفظ كمسودة
        </Button>
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          disabled={isPending || !customerId || items.every((it) => !it.productId)}
          onClick={() => setConfirmImmediately(true)}
        >
          {isPending && confirmImmediately ? <Loader2 size={16} className="animate-spin" /> : null}
          حفظ وتأكيد
        </Button>
      </div>
    </form>
  );
}
