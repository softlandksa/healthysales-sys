import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Edit, MapPin, ShoppingCart } from "lucide-react";
import { unstable_cache } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountStatement } from "@/components/customers/AccountStatement";
import { formatSAR } from "@/lib/utils";
import { ORDER_STATUS_LABELS, VISIT_TYPE_LABELS } from "@/types";
import type { TransactionType, SalesOrderStatus, VisitType } from "@/types";
import { format } from "date-fns";

export const metadata: Metadata = { title: "كشف حساب عميل" };

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    type?: string;
    page?: string;
  }>;
}

function getCustomerData(id: string) {
  return unstable_cache(
    async () => {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [customer, ytdSales, ytdCollections, lastVisit, upcomingDeliveries, recentVisits, recentOrders] = await Promise.all([
        prisma.customer.findUnique({
          where: { id },
          select: {
            id: true, code: true, nameAr: true, nameEn: true,
            phone: true, phone2: true, address: true,
            balance: true, openingBalance: true, creditLimit: true,
            isActive: true,
            assignedTo: { select: { name: true, email: true } },
            team: { select: { nameAr: true } },
            region: { select: { nameAr: true } },
          },
        }),
        prisma.customerTransaction.aggregate({
          where: { customerId: id, type: "sale", transactionDate: { gte: yearStart } },
          _sum: { amount: true },
        }),
        prisma.customerTransaction.aggregate({
          where: { customerId: id, type: "collection", transactionDate: { gte: yearStart } },
          _sum: { amount: true },
        }),
        prisma.visit.findFirst({
          where: { customerId: id },
          orderBy: { visitedAt: "desc" },
          select: { visitedAt: true, visitType: true },
        }),
        prisma.salesOrder.count({
          where: { customerId: id, status: "confirmed" },
        }),
        prisma.visit.findMany({
          where: { customerId: id },
          orderBy: { visitedAt: "desc" },
          take: 10,
          select: {
            id: true, code: true, visitType: true, visitedAt: true,
            rep: { select: { name: true } },
            salesOrder: { select: { id: true } },
            collection: { select: { id: true } },
          },
        }),
        prisma.salesOrder.findMany({
          where: { customerId: id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true, code: true, status: true, total: true, createdAt: true,
            rep: { select: { name: true } },
          },
        }),
      ]);

      return { customer, ytdSales, ytdCollections, lastVisit, upcomingDeliveries, recentVisits, recentOrders };
    },
    [`customer-profile-${id}`],
    { tags: [`customer-${id}`], revalidate: 300 }
  )();
}

export default async function CustomerStatementPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const { from = "", to = "", type = "", page = "1" } = await searchParams;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Customer")) redirect("/ar/dashboard");

  const canEdit = ability.can("update", "Customer");

  const { customer, ytdSales, ytdCollections, lastVisit, upcomingDeliveries, recentVisits, recentOrders } =
    await getCustomerData(id);

  if (!customer) notFound();

  const pageSize = 25;
  const pageNum = Math.max(1, parseInt(page, 10));

  const txWhere = {
    customerId: id,
    ...(from || to ? { transactionDate: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
    }} : {}),
    ...(type ? { type: type as TransactionType } : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.customerTransaction.findMany({
      where: txWhere,
      orderBy: { transactionDate: "asc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, type: true, amount: true, balance: true,
        description: true, reference: true, transactionDate: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.customerTransaction.count({ where: txWhere }),
  ]);

  const rows = transactions.map((t) => ({
    id: t.id,
    type: t.type as TransactionType,
    amount: t.amount.toFixed(2),
    balance: t.balance.toFixed(2),
    description: t.description,
    reference: t.reference,
    transactionDate: t.transactionDate,
    createdByName: t.createdBy?.name ?? null,
  }));

  const ytdSalesAmt = ytdSales._sum.amount?.toFixed(2) ?? "0.00";
  const ytdCollAmt = ytdCollections._sum.amount ? Math.abs(ytdCollections._sum.amount.toNumber()).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb
            items={[
              { label: "الرئيسية", href: "/ar/dashboard" },
              { label: "العملاء", href: "/ar/customers" },
              { label: customer.nameAr },
            ]}
          />
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold text-text-primary">{customer.nameAr}</h1>
            <Badge variant={customer.isActive ? "success" : "secondary"}>
              {customer.isActive ? "نشط" : "غير نشط"}
            </Badge>
          </div>
          <p className="text-sm text-text-secondary mt-0.5">
            {customer.code}
            {customer.nameEn && <span className="ms-2 text-text-muted" dir="ltr">{customer.nameEn}</span>}
          </p>
        </div>
        {canEdit && (
          <Link href={`/ar/customers/${id}/edit`}>
            <Button variant="outline"><Edit size={15} />تعديل</Button>
          </Link>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">الرصيد الحالي</p>
          <p className={`font-bold text-lg num ${parseFloat(customer.balance.toFixed(2)) > 0 ? "text-danger-600" : "text-success-600"}`}>
            {formatSAR(customer.balance.toFixed(2))}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">مبيعات {new Date().getFullYear()}</p>
          <p className="font-bold text-lg num text-text-primary">{formatSAR(ytdSalesAmt)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">تحصيلات {new Date().getFullYear()}</p>
          <p className="font-bold text-lg num text-text-primary">{formatSAR(ytdCollAmt)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">طلبات بانتظار التسليم</p>
          <p className="font-bold text-lg num">{upcomingDeliveries}</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {customer.phone && (
          <div className="card p-4">
            <p className="text-xs text-text-muted mb-1">الهاتف</p>
            <p className="font-medium num">{customer.phone}</p>
          </div>
        )}
        {customer.assignedTo && (
          <div className="card p-4">
            <p className="text-xs text-text-muted mb-1">المندوب</p>
            <p className="font-medium">{customer.assignedTo.name ?? customer.assignedTo.email}</p>
          </div>
        )}
        {customer.team && (
          <div className="card p-4">
            <p className="text-xs text-text-muted mb-1">الفريق</p>
            <p className="font-medium">{customer.team.nameAr}</p>
          </div>
        )}
        {customer.creditLimit && (
          <div className="card p-4">
            <p className="text-xs text-text-muted mb-1">حد الائتمان</p>
            <p className="font-medium num">{formatSAR(customer.creditLimit.toFixed(2))}</p>
          </div>
        )}
        {lastVisit && (
          <div className="card p-4">
            <p className="text-xs text-text-muted mb-1">آخر زيارة</p>
            <p className="font-medium num text-sm">{format(new Date(lastVisit.visitedAt), "dd/MM/yyyy")}</p>
            <p className="text-xs text-text-muted">{VISIT_TYPE_LABELS[lastVisit.visitType as VisitType]}</p>
          </div>
        )}
      </div>

      {/* Recent visits */}
      {recentVisits.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <MapPin size={18} className="text-brand-600" />
              آخر الزيارات
            </h2>
            <Link href={`/ar/visits?customerId=${id}`} className="text-sm text-brand-600 hover:underline">
              الكل
            </Link>
          </div>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-border">
              {recentVisits.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-1 transition-colors">
                  <div>
                    <Link href={`/ar/visits/${v.id}`} className="text-sm font-medium text-brand-700 hover:underline num">
                      {v.code}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={v.visitType === "sale" ? "warning" : v.visitType === "collection" ? "success" : "default"} className="text-xs">
                        {VISIT_TYPE_LABELS[v.visitType as VisitType]}
                      </Badge>
                      <span className="text-xs text-text-muted">{v.rep.name ?? "—"}</span>
                    </div>
                  </div>
                  <span className="text-xs text-text-muted num">
                    {format(new Date(v.visitedAt), "dd/MM/yyyy")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <ShoppingCart size={18} className="text-brand-600" />
              آخر الطلبات
            </h2>
            <Link href={`/ar/sales?customerId=${id}`} className="text-sm text-brand-600 hover:underline">
              الكل
            </Link>
          </div>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-border">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-1 transition-colors">
                  <div>
                    <Link href={`/ar/sales/${o.id}`} className="text-sm font-medium text-brand-700 hover:underline num">
                      {o.code}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant={
                          o.status === "collected" ? "success" :
                          o.status === "cancelled" ? "danger" :
                          o.status === "confirmed" ? "warning" : "default"
                        }
                        className="text-xs"
                      >
                        {ORDER_STATUS_LABELS[o.status as SalesOrderStatus]}
                      </Badge>
                      <span className="text-xs text-text-muted">{o.rep.name ?? "—"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold num">{formatSAR(o.total.toFixed(2))}</p>
                    <p className="text-xs text-text-muted num">{format(new Date(o.createdAt), "dd/MM/yyyy")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Statement */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">كشف الحساب</h2>
        <AccountStatement
          customerId={id}
          balance={customer.balance.toFixed(2)}
          openingBalance={customer.openingBalance.toFixed(2)}
          rows={rows}
          total={total}
          page={pageNum}
          pageSize={pageSize}
          fromDate={from}
          toDate={to}
          typeFilter={type}
        />
      </div>
    </div>
  );
}
