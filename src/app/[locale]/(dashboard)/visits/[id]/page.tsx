import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { MapPin, ShoppingCart, Wallet, Navigation2 } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getVisit } from "@/server/actions/visits";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VISIT_TYPE_LABELS } from "@/types";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { formatSAR } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/types";

export const metadata: Metadata = { title: "تفاصيل الزيارة" };

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function VisitDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Visit")) notFound();

  const visit = await getVisit(id).catch(() => null);
  if (!visit) notFound();

  const IconComponent = visit.visitType === "sale" ? ShoppingCart : visit.visitType === "collection" ? Wallet : MapPin;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "الزيارات", href: "/ar/visits" },
            { label: visit.code },
          ]}
        />
        <div className="flex items-center gap-3 mt-2">
          <IconComponent size={22} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-text-primary num">{visit.code}</h1>
          <Badge variant={visit.visitType === "sale" ? "warning" : visit.visitType === "collection" ? "success" : "default"}>
            {VISIT_TYPE_LABELS[visit.visitType as import("@/types").VisitType]}
          </Badge>
        </div>
        <p className="text-sm text-text-secondary mt-1 num">
          {format(new Date(visit.visitedAt), "EEEE d MMMM yyyy — HH:mm", { locale: ar })}
        </p>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">العميل</p>
          <Link href={`/ar/customers/${visit.customer.id}`} className="font-medium text-brand-700 hover:underline">
            {visit.customer.nameAr}
          </Link>
          <p className="text-xs text-text-muted num">{visit.customer.code}</p>
          {visit.customer.phone && <p className="text-xs text-text-muted num mt-0.5">{visit.customer.phone}</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">المندوب</p>
          <p className="font-medium">{visit.rep.name ?? visit.rep.email}</p>
          <p className="text-xs text-text-muted">{visit.rep.role}</p>
        </div>
        {visit.latitude && visit.longitude && (
          <div className="card p-4 flex items-start gap-2">
            <Navigation2 size={16} className="text-brand-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-text-muted mb-0.5">الموقع الجغرافي</p>
              <p className="text-sm num">{visit.latitude.toFixed(5)}, {visit.longitude.toFixed(5)}</p>
            </div>
          </div>
        )}
        {visit.notes && (
          <div className="card p-4 sm:col-span-2">
            <p className="text-xs text-text-muted mb-1">ملاحظات</p>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{visit.notes}</p>
          </div>
        )}
      </div>

      {/* Linked order */}
      {visit.salesOrder && (
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-2">طلب البيع المرتبط</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium num">{visit.salesOrder.code}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default">{ORDER_STATUS_LABELS[visit.salesOrder.status as import("@/types").SalesOrderStatus]}</Badge>
                <span className="text-sm text-text-secondary num">{formatSAR(visit.salesOrder.total.toString())}</span>
              </div>
            </div>
            <Link href={`/ar/sales/${visit.salesOrder.id}`}>
              <Button variant="outline" size="sm">عرض الطلب</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Linked collection */}
      {visit.collection && (
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-2">التحصيل المرتبط</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium num">{visit.collection.code}</p>
              <div className="flex items-center gap-2 mt-1">
                {visit.collection.isCancelled && <Badge variant="danger">ملغى</Badge>}
                <span className="text-sm text-text-secondary num">{formatSAR(visit.collection.amount.toString())}</span>
              </div>
            </div>
            <Link href={`/ar/collections/${visit.collection.id}`}>
              <Button variant="outline" size="sm">عرض التحصيل</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!visit.salesOrder && visit.visitType !== "collection" && (
        <div className="flex gap-3">
          <Link href={`/ar/sales/new?visitId=${visit.id}&customerId=${visit.customer.id}&customerName=${encodeURIComponent(visit.customer.nameAr)}`}>
            <Button variant="outline">
              <ShoppingCart size={15} />
              إنشاء طلب بيع
            </Button>
          </Link>
        </div>
      )}
      {!visit.collection && visit.visitType !== "sale" && (
        <div className="flex gap-3">
          <Link href={`/ar/collections/new?visitId=${visit.id}&customerId=${visit.customer.id}&customerName=${encodeURIComponent(visit.customer.nameAr)}`}>
            <Button variant="outline">
              <Wallet size={15} />
              إنشاء تحصيل
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
