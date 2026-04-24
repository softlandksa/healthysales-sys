import { prisma } from "@/lib/db/prisma";
import type {
  CustomersReportFilters,
  CustomersReportData,
  CustomerBuyerRow,
  CustomerCategory,
} from "../types";

function assignCategory(
  buyers: Array<{ customerId: string; name: string; sales: number; orders: number }>
): CustomerBuyerRow[] {
  const totalRevenue = buyers.reduce((s, b) => s + b.sales, 0);
  let cumulative     = 0;
  return buyers.map((b) => {
    cumulative += b.sales;
    const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 100;
    let category: CustomerCategory = "C";
    if (pct <= 80) category = "A";
    else if (pct <= 95) category = "B";
    return { ...b, category };
  });
}

export async function buildCustomersReport(
  filters: CustomersReportFilters,
  accessibleIds: string[]
): Promise<CustomersReportData> {
  const { from, to, repId, teamId } = filters;

  // Scope customers to accessible reps
  const repFilter = repId
    ? { assignedToId: repId }
    : teamId
    ? { teamId }
    : { assignedToId: { in: accessibleIds } };

  // Top buyers by collected sales
  const buyerGroups = await prisma.salesOrder.groupBy({
    by:    ["customerId"],
    where: {
      customer:    repFilter,
      status:      "collected",
      collectedAt: { gte: from, lte: to },
    },
    _sum:  { total: true },
    _count: { id: true },
    orderBy: { _sum: { total: "desc" } },
    take: 50,
  });

  const buyerCustomerIds = buyerGroups.map((b) => b.customerId);
  const buyerCustomers   = await prisma.customer.findMany({
    where: { id: { in: buyerCustomerIds } },
    select: { id: true, nameAr: true },
  });
  const buyerNameMap = new Map(buyerCustomers.map((c) => [c.id, c.nameAr]));

  const rawBuyers = buyerGroups.map((b) => ({
    customerId: b.customerId,
    name:       buyerNameMap.get(b.customerId) ?? b.customerId,
    sales:      Number(b._sum.total ?? 0),
    orders:     b._count.id,
  }));

  const topBuyers = assignCategory(rawBuyers);

  // High balances (customers with outstanding balance > 0)
  const balanceRows = await prisma.customer.findMany({
    where: {
      ...repFilter,
      balance: { gt: 0 },
    },
    select: {
      id: true, nameAr: true, balance: true, creditLimit: true,
      assignedTo: { select: { name: true } },
    },
    orderBy: { balance: "desc" },
    take: 50,
  });

  const highBalances = balanceRows.map((c) => ({
    customerId:  c.id,
    name:        c.nameAr,
    balance:     Number(c.balance),
    creditLimit: c.creditLimit !== null ? Number(c.creditLimit) : null,
    repName:     c.assignedTo?.name ?? null,
  }));

  // Visit frequency
  const visitGroups = await prisma.visit.groupBy({
    by:    ["customerId"],
    where: {
      repId:     repId ? repId : { in: accessibleIds },
      visitedAt: { gte: from, lte: to },
    },
    _count: { id: true },
    _max:   { visitedAt: true },
    orderBy: { _count: { id: "desc" } },
    take: 50,
  });

  const visitCustomerIds = visitGroups.map((v) => v.customerId);
  const visitCustomers   = await prisma.customer.findMany({
    where: { id: { in: visitCustomerIds } },
    select: { id: true, nameAr: true },
  });
  const visitNameMap = new Map(visitCustomers.map((c) => [c.id, c.nameAr]));

  const visitFrequency = visitGroups.map((v) => ({
    customerId: v.customerId,
    name:       visitNameMap.get(v.customerId) ?? v.customerId,
    visits:     v._count.id,
    lastVisit:  v._max.visitedAt,
  }));

  // Summary
  const [totalCustomers, balanceSummary] = await Promise.all([
    prisma.customer.count({ where: { ...repFilter, isActive: true } }),
    prisma.customer.aggregate({
      where: { ...repFilter, balance: { gt: 0 } },
      _sum: { balance: true },
      _avg: { balance: true },
    }),
  ]);

  return {
    topBuyers,
    highBalances,
    visitFrequency,
    summary: {
      totalCustomers,
      totalOutstanding: Number(balanceSummary._sum.balance ?? 0),
      avgBalance:       Number(balanceSummary._avg.balance ?? 0),
    },
  };
}
