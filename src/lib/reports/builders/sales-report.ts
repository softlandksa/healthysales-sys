import { prisma } from "@/lib/db/prisma";
import type { SalesOrderStatus } from "@prisma/client";
import type { SalesReportFilters, SalesReportData } from "../types";

export async function buildSalesReport(
  filters: SalesReportFilters,
  accessibleIds: string[]
): Promise<SalesReportData> {
  const repFilter = filters.repId ? [filters.repId] : accessibleIds;

  const baseWhere = {
    repId:     { in: repFilter },
    createdAt: { gte: filters.from, lte: filters.to },
    ...(filters.status ? { status: filters.status as SalesOrderStatus } : {}),
  };

  const itemWhere = {
    order: {
      repId:     { in: repFilter },
      createdAt: { gte: filters.from, lte: filters.to },
      ...(filters.status ? { status: filters.status as SalesOrderStatus } : {}),
    },
  };

  const [ordersR, byRepR, countsByStatusR, byProductR] = await Promise.allSettled([
    prisma.salesOrder.findMany({
      where: baseWhere,
      select: {
        id: true, code: true, status: true, total: true, createdAt: true,
        customer: { select: { nameAr: true } },
        rep:      { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.salesOrder.groupBy({
      by: ["repId"],
      where: baseWhere,
      _count: { id: true },
      _sum:   { total: true },
      orderBy: { _sum: { total: "desc" } },
    }),
    prisma.salesOrder.groupBy({
      by: ["status"],
      where: { repId: { in: repFilter }, createdAt: { gte: filters.from, lte: filters.to } },
      _count: { id: true },
    }),
    prisma.salesOrderItem.groupBy({
      by: ["productId"],
      where: itemWhere,
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 20,
    }),
  ] as const);

  const orders          = ordersR.status         === "fulfilled" ? ordersR.value         : [];
  const byRepGroups     = byRepR.status          === "fulfilled" ? byRepR.value          : [];
  const countsByStatus  = countsByStatusR.status === "fulfilled" ? countsByStatusR.value : [];
  const byProductGroups = byProductR.status      === "fulfilled" ? byProductR.value      : [];

  // Resolve rep names
  const repIds = byRepGroups.map((g) => g.repId);
  const repUsers = repIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true } }).catch(() => [])
    : [];
  const repNameMap = new Map(repUsers.map((u) => [u.id, u.name]));

  // Resolve product info
  const productIds = byProductGroups.map((g) => g.productId);
  const products = productIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, nameAr: true, code: true, unit: true } }).catch(() => [])
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const totalAmount   = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders   = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;
  const getCount = (s: string) => countsByStatus.find((c) => c.status === s)?._count.id ?? 0;

  return {
    summary: {
      totalOrders,
      totalAmount,
      avgOrderValue,
      confirmedCount: getCount("confirmed"),
      collectedCount: getCount("collected"),
      cancelledCount: getCount("cancelled"),
      deliveredCount: getCount("delivered"),
    },
    byRep: byRepGroups.map((g) => ({
      repId:   g.repId,
      repName: repNameMap.get(g.repId) ?? null,
      orders:  g._count.id,
      amount:  Number(g._sum.total ?? 0),
    })),
    byProduct: byProductGroups.map((g) => {
      const prod = productMap.get(g.productId);
      return {
        productId:   g.productId,
        productName: prod?.nameAr ?? g.productId,
        productCode: prod?.code   ?? "",
        unit:        prod?.unit   ?? "",
        quantity:    g._sum.quantity ?? 0,
        revenue:     Number(g._sum.lineTotal ?? 0),
      };
    }),
    orders: orders.map((o) => ({
      id:           o.id,
      code:         o.code,
      customerName: o.customer.nameAr,
      repName:      o.rep.name,
      status:       o.status,
      total:        Number(o.total),
      createdAt:    o.createdAt,
    })),
  };
}
