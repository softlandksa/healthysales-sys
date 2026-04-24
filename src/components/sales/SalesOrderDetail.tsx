"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle, Truck, Package, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { confirmSalesOrder, deliverSalesOrder, collectSalesOrder, cancelSalesOrder } from "@/server/actions/sales";
import { ORDER_STATUS_LABELS } from "@/types";
import { expiryStatus, statusLabel, EXPIRY_STATUS_CLASSES } from "@/lib/utils/expiry";
import { formatSAR, cn } from "@/lib/utils";
import { format } from "date-fns";
import type { SalesOrderStatus } from "@/types";

interface AuditEntry {
  id: string;
  action: string;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
}

interface OrderItem {
  id: string;
  productCode: string;
  productNameAr: string;
  productUnit: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  expiryDate: Date;
}

interface OrderDetail {
  id: string;
  code: string;
  status: SalesOrderStatus;
  subtotal: string;
  discount: string;
  total: string;
  notes: string | null;
  cancelReason: string | null;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  collectedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  customer: { id: string; code: string; nameAr: string; balance: string };
  rep: { name: string | null; email: string };
  visit: { id: string; code: string; visitedAt: Date } | null;
  items: OrderItem[];
}

interface SalesOrderDetailProps {
  order: OrderDetail;
  recentAudit: AuditEntry[];
  canManage: boolean;
}

const STATUS_VARIANT: Record<SalesOrderStatus, "default" | "success" | "warning" | "danger" | "secondary"> = {
  draft:      "secondary",
  confirmed:  "warning",
  delivered:  "default",
  collected:  "success",
  cancelled:  "danger",
};

export function SalesOrderDetail({ order, recentAudit, canManage }: SalesOrderDetailProps) {
  const [isPending, startTransition] = useTransition();

  function handleAction(fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const r = await fn();
      if (r.success) toast.success(successMsg);
      else toast.error(r.error ?? "حدث خطأ");
    });
  }

  const discountNum = parseFloat(order.discount);

  return (
    <div className="space-y-6">
      {/* Status machine buttons */}
      <div className="card p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-secondary">الحالة:</span>
          <Badge variant={STATUS_VARIANT[order.status]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.status === "draft" && canManage && (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => handleAction(() => confirmSalesOrder(order.id), "تم تأكيد الطلب")}
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              تأكيد
            </Button>
          )}
          {order.status === "confirmed" && canManage && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleAction(() => deliverSalesOrder(order.id), "تم تسليم الطلب")}
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              تسليم
            </Button>
          )}
          {order.status === "delivered" && canManage && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleAction(() => collectSalesOrder(order.id), "تم تحديث حالة التحصيل")}
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              تحصيل
            </Button>
          )}
          {order.status !== "collected" && order.status !== "cancelled" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-danger-600 hover:text-danger-700" disabled={isPending}>
                  <XCircle size={14} />
                  إلغاء
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>إلغاء الطلب</AlertDialogTitle>
                  <AlertDialogDescription>
                    هل أنت متأكد من إلغاء الطلب {order.code}؟ لا يمكن التراجع عن هذا الإجراء.
                    {(order.status === "confirmed" || order.status === "delivered") && (
                      <span className="block mt-2 text-warning-600 font-medium">
                        سيتم عكس القيد المحاسبي وتخفيض رصيد العميل.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-danger-600 hover:bg-danger-700"
                    onClick={() => handleAction(() => cancelSalesOrder(order.id, "إلغاء يدوي"), "تم إلغاء الطلب")}
                  >
                    تأكيد الإلغاء
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">العميل</p>
          <Link href={`/ar/customers/${order.customer.id}`} className="font-medium text-brand-700 hover:underline text-sm">
            {order.customer.nameAr}
          </Link>
          <p className="text-xs text-text-muted num">{order.customer.code}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">المندوب</p>
          <p className="font-medium text-sm">{order.rep.name ?? order.rep.email}</p>
        </div>
        {order.confirmedAt && (
          <div className="card p-4">
            <p className="text-xs text-text-muted mb-1">تاريخ التأكيد</p>
            <p className="font-medium text-sm num">{format(new Date(order.confirmedAt), "dd/MM/yyyy")}</p>
          </div>
        )}
        {order.visit && (
          <div className="card p-4">
            <p className="text-xs text-text-muted mb-1">الزيارة</p>
            <Link href={`/ar/visits/${order.visit.id}`} className="font-medium text-brand-700 hover:underline text-sm num">
              {order.visit.code}
            </Link>
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-text-primary">المنتجات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-right px-4 py-2 font-medium text-text-secondary">المنتج</th>
                <th className="text-right px-4 py-2 font-medium text-text-secondary">الكمية</th>
                <th className="text-right px-4 py-2 font-medium text-text-secondary">السعر</th>
                <th className="text-right px-4 py-2 font-medium text-text-secondary">الإجمالي</th>
                <th className="text-right px-4 py-2 font-medium text-text-secondary">الانتهاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items.map((item) => {
                const exp = expiryStatus(new Date(item.expiryDate));
                const expClass = EXPIRY_STATUS_CLASSES[exp];
                return (
                  <tr key={item.id} className="hover:bg-surface-1">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.productNameAr}</div>
                      <div className="text-xs text-text-muted num">{item.productCode} — {item.productUnit}</div>
                    </td>
                    <td className="px-4 py-3 num">{item.quantity}</td>
                    <td className="px-4 py-3 num">{formatSAR(item.unitPrice)}</td>
                    <td className="px-4 py-3 font-semibold num">{formatSAR(item.lineTotal)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", expClass)}>
                        {statusLabel(new Date(item.expiryDate))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-4 py-3 border-t border-border space-y-1 bg-surface-1">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>المجموع الفرعي</span>
            <span className="num">{formatSAR(order.subtotal)}</span>
          </div>
          {discountNum > 0 && (
            <div className="flex justify-between text-sm text-danger-600">
              <span>الخصم</span>
              <span className="num">- {formatSAR(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-1">
            <span>الإجمالي</span>
            <span className="num">{formatSAR(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Cancel reason */}
      {order.cancelReason && (
        <div className="card p-4 border-danger-200 bg-danger-50">
          <p className="text-xs text-danger-600 mb-1 font-medium">سبب الإلغاء</p>
          <p className="text-sm text-danger-800">{order.cancelReason}</p>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">ملاحظات</p>
          <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      {/* Audit trail */}
      {recentAudit.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-text-primary">سجل التغييرات</h3>
          </div>
          <ul className="divide-y divide-border">
            {recentAudit.map((entry) => (
              <li key={entry.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">{entry.action}</p>
                  <p className="text-xs text-text-muted">{entry.user?.name ?? entry.user?.email ?? "—"}</p>
                </div>
                <p className="text-xs text-text-muted num shrink-0">
                  {format(new Date(entry.createdAt), "dd/MM HH:mm")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
