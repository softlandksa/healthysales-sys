import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getSalesOrderDetail } from "@/server/actions/sales";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SalesOrderDetail } from "@/components/sales/SalesOrderDetail";
import type { SalesOrderStatus } from "@/types";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function SalesOrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "SalesOrder")) redirect("/ar/dashboard");

  const canManage = ["admin", "general_manager", "sales_manager", "team_manager"].includes(currentUser.role);

  const result = await getSalesOrderDetail(id).catch(() => null);
  if (!result) notFound();

  const { order, recentAudit } = result;

  const orderDetail = {
    id: order.id,
    code: order.code,
    status: order.status as SalesOrderStatus,
    subtotal: order.subtotal.toFixed(2),
    discount: order.discount.toFixed(2),
    total: order.total.toFixed(2),
    notes: order.notes,
    cancelReason: order.cancelReason ?? null,
    confirmedAt: order.confirmedAt,
    deliveredAt: order.deliveredAt,
    collectedAt: order.collectedAt,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    customer: {
      id: order.customer.id,
      code: order.customer.code,
      nameAr: order.customer.nameAr,
      balance: order.customer.balance.toFixed(2),
    },
    rep: order.rep,
    visit: order.visit
      ? { id: order.visit.id, code: order.visit.code, visitedAt: order.visit.visitedAt }
      : null,
    items: order.items.map((it) => ({
      id: it.id,
      productCode: it.product.code,
      productNameAr: it.product.nameAr,
      productUnit: it.product.unit,
      quantity: it.quantity,
      unitPrice: it.unitPrice.toFixed(2),
      lineTotal: it.lineTotal.toFixed(2),
      expiryDate: it.expiryDate,
    })),
  };

  const auditEntries = recentAudit.map((a) => ({
    id: a.id,
    action: a.action,
    createdAt: a.createdAt,
    user: a.user,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "طلبات البيع", href: "/ar/sales" },
            { label: order.code },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2 num">{order.code}</h1>
      </div>

      <SalesOrderDetail
        order={orderDetail}
        recentAudit={auditEntries}
        canManage={canManage}
      />
    </div>
  );
}
