import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  RepReportFilters,
  RepReportData,
  MonthPoint,
} from "../types";

export async function buildRepReport(
  filters: RepReportFilters,
  accessibleIds: string[]
): Promise<RepReportData> {
  const { repId, from, to } = filters;

  if (!accessibleIds.includes(repId)) {
    throw new Error("Access denied to this rep");
  }

  const rep = await prisma.user.findUnique({
    where: { id: repId },
    select: { id: true, name: true, email: true },
  });
  if (!rep) throw new Error("Rep not found");

  const collectedWhere = {
    repId,
    status: "collected" as const,
    collectedAt: { gte: from, lte: to },
  };

  const [salesAgg, collAgg, visitsCount, openOrders, ordersByStatusRaw, topCustomersRaw, topProductsRaw] =
    await Promise.all([
      prisma.salesOrder.aggregate({
        where: collectedWhere,
        _sum:   { total: true },
        _count: { id: true },
      }),
      prisma.collection.aggregate({
        where: { repId, isCancelled: false, collectedAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.visit.count({ where: { repId, visitedAt: { gte: from, lte: to } } }),
      prisma.salesOrder.count({
        where: { repId, status: { in: ["confirmed", "delivered"] } },
      }),
      prisma.salesOrder.groupBy({
        by:    ["status"],
        where: { repId, createdAt: { gte: from, lte: to } },
        _count: { id: true },
      }),
      prisma.salesOrder.groupBy({
        by:    ["customerId"],
        where: collectedWhere,
        _sum:  { total: true },
        orderBy: { _sum: { total: "desc" } },
        take:  10,
      }),
      prisma.salesOrderItem.groupBy({
        by:    ["productId"],
        where: {
          order: collectedWhere,
        },
        _sum:  { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: "desc" } },
        take:  10,
      }),
    ]);

  const totalSales    = Number(salesAgg._sum.total ?? 0);
  const totalOrders   = salesAgg._count.id;
  const totalCollections = Number(collAgg._sum.amount ?? 0);

  // Resolve customer names
  const customerIds = topCustomersRaw.map((r) => r.customerId);
  const [customers, visitsByCustomer] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, nameAr: true },
    }),
    prisma.visit.groupBy({
      by:    ["customerId"],
      where: { repId, customerId: { in: customerIds }, visitedAt: { gte: from, lte: to } },
      _count: { id: true },
    }),
  ]);
  const customerNameMap = new Map(customers.map((c) => [c.id, c.nameAr]));
  const visitMap        = new Map(visitsByCustomer.map((v) => [v.customerId, v._count.id]));

  const topCustomers = topCustomersRaw.map((r) => ({
    customerId:   r.customerId,
    customerName: customerNameMap.get(r.customerId) ?? r.customerId,
    sales:        Number(r._sum.total ?? 0),
    visits:       visitMap.get(r.customerId) ?? 0,
  }));

  // Resolve product names
  const productIds = topProductsRaw.map((r) => r.productId);
  const products   = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, code: true, nameAr: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const topProducts = topProductsRaw.map((r) => {
    const p = productMap.get(r.productId);
    return {
      productId:   r.productId,
      productCode: p?.code ?? "",
      productName: p?.nameAr ?? r.productId,
      units:       Number(r._sum.quantity ?? 0),
      revenue:     Number(r._sum.lineTotal ?? 0),
    };
  });

  const ordersByStatus = Object.fromEntries(
    ordersByStatusRaw.map((r) => [r.status, r._count.id])
  );

  // Monthly trend: raw SQL for date truncation in Riyadh timezone
  const monthlyRaw = await prisma.$queryRaw<
    Array<{ month: string; sales: string | null; visits: bigint }>
  >(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', s.collected_at AT TIME ZONE 'Asia/Riyadh'), 'YYYY-MM') AS month,
      SUM(s.total)::text AS sales,
      0::bigint           AS visits
    FROM sales_orders s
    WHERE s.rep_id    = ${repId}
      AND s.status    = 'collected'
      AND s.collected_at >= ${from}
      AND s.collected_at <= ${to}
    GROUP BY month

    UNION ALL

    SELECT
      TO_CHAR(DATE_TRUNC('month', v.visited_at AT TIME ZONE 'Asia/Riyadh'), 'YYYY-MM') AS month,
      NULL            AS sales,
      COUNT(v.id)     AS visits
    FROM visits v
    WHERE v.rep_id   = ${repId}
      AND v.visited_at >= ${from}
      AND v.visited_at <= ${to}
    GROUP BY month
    ORDER BY month
  `);

  // Merge by month
  const monthMap = new Map<string, MonthPoint>();
  for (const row of monthlyRaw) {
    const existing = monthMap.get(row.month) ?? { month: row.month, sales: 0, collections: 0, visits: 0 };
    if (row.sales !== null) existing.sales += parseFloat(row.sales);
    existing.visits += Number(row.visits);
    monthMap.set(row.month, existing);
  }

  // Collections monthly
  const collMonthly = await prisma.$queryRaw<Array<{ month: string; amount: string }>>(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', c.collected_at AT TIME ZONE 'Asia/Riyadh'), 'YYYY-MM') AS month,
      SUM(c.amount)::text AS amount
    FROM collections c
    WHERE c.rep_id     = ${repId}
      AND c.is_cancelled = false
      AND c.collected_at >= ${from}
      AND c.collected_at <= ${to}
    GROUP BY month
    ORDER BY month
  `);
  for (const row of collMonthly) {
    const existing = monthMap.get(row.month) ?? { month: row.month, sales: 0, collections: 0, visits: 0 };
    existing.collections += parseFloat(row.amount);
    monthMap.set(row.month, existing);
  }

  const monthlyTrend = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  return {
    rep,
    summary: {
      totalSales,
      totalCollections,
      totalVisits:   visitsCount,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      openOrders,
    },
    monthlyTrend,
    topCustomers,
    topProducts,
    ordersByStatus,
  };
}
