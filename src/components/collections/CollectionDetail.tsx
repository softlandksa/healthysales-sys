"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelCollection } from "@/server/actions/collections";
import { PAYMENT_METHOD_LABELS } from "@/types";
import { formatSAR } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { PaymentMethod } from "@/types";

interface CollectionDetailProps {
  id: string;
  code: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  cancelReason: string | null;
  isCancelled: boolean;
  cancelledAt: Date | null;
  collectedAt: Date;
  customer: { id: string; code: string; nameAr: string };
  rep: { name: string | null; email: string };
  visit: { id: string; code: string } | null;
  canCancel: boolean;
}

export function CollectionDetail({
  id, amount, method, reference, notes, cancelReason, isCancelled, cancelledAt,
  collectedAt, customer, rep, visit, canCancel,
}: CollectionDetailProps) {
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const r = await cancelCollection(id, cancelReasonInput);
      if (r.success) toast.success("تم إلغاء التحصيل");
      else toast.error(r.error ?? "حدث خطأ");
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status strip */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-secondary">الحالة:</span>
          {isCancelled ? <Badge variant="danger">ملغى</Badge> : <Badge variant="success">نشط</Badge>}
        </div>
        {canCancel && !isCancelled && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-danger-600 hover:text-danger-700" disabled={isPending}>
                <XCircle size={14} />
                إلغاء التحصيل
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>إلغاء التحصيل</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم عكس القيد المحاسبي وإضافة <span className="font-bold num">{formatSAR(amount)}</span> إلى رصيد العميل.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-1 py-2">
                <Label className="text-sm">سبب الإلغاء</Label>
                <Input
                  className="mt-1"
                  placeholder="أدخل سبب الإلغاء..."
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>تراجع</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-danger-600 hover:bg-danger-700"
                  onClick={handleCancel}
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  تأكيد الإلغاء
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">العميل</p>
          <Link href={`/ar/customers/${customer.id}`} className="font-medium text-brand-700 hover:underline">
            {customer.nameAr}
          </Link>
          <p className="text-xs text-text-muted num">{customer.code}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">المبلغ</p>
          <p className="text-xl font-bold num">{formatSAR(amount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">طريقة الدفع</p>
          <p className="font-medium">{PAYMENT_METHOD_LABELS[method]}</p>
          {reference && <p className="text-xs text-text-muted num mt-0.5">{reference}</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">تاريخ التحصيل</p>
          <p className="font-medium num">{format(new Date(collectedAt), "d MMMM yyyy", { locale: ar })}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">المندوب</p>
          <p className="font-medium">{rep.name ?? rep.email}</p>
        </div>
        {visit && (
          <div className="card p-4">
            <p className="text-xs text-text-muted mb-1">الزيارة</p>
            <Link href={`/ar/visits/${visit.id}`} className="font-medium text-brand-700 hover:underline num">
              {visit.code}
            </Link>
          </div>
        )}
      </div>

      {notes && (
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">ملاحظات</p>
          <p className="text-sm whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      {isCancelled && (
        <div className="card p-4 border-danger-200 bg-danger-50">
          <p className="text-xs text-danger-600 mb-1 font-medium">
            تم الإلغاء في {cancelledAt ? format(new Date(cancelledAt), "d MMMM yyyy", { locale: ar }) : "—"}
          </p>
          {cancelReason && <p className="text-sm text-danger-800">{cancelReason}</p>}
        </div>
      )}
    </div>
  );
}
