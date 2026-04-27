import { prisma } from "@/lib/prisma";
import type { ProductsReportFilters, ProductsReportData } from "../types";

export async function buildProductsReport(
  filters: ProductsReportFilters
): Promise<ProductsReportData> {
  const activeWhere = filters.isActive !== undefined ? { isActive: filters.isActive } : {};

  const [productsR, summaryGroupsR, salesGroupsR] = await Promise.allSettled([
    prisma.product.findMany({
      where: activeWhere,
      orderBy: { nameAr: "asc" },
    }),
    prisma.product.groupBy({
      by:     ["isActive"],
      _count: { id: true },
    }),
    prisma.salesOrderItem.groupBy({
      by:    ["productId"],
      where: {
        order: { createdAt: { gte: filters.from, lte: filters.to } },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
    }),
  ] as const);

  const products      = productsR.status      === "fulfilled" ? productsR.value      : [];
  const summaryGroups = summaryGroupsR.status === "fulfilled" ? summaryGroupsR.value : [];
  const salesGroups   = salesGroupsR.status   === "fulfilled" ? salesGroupsR.value   : [];

  const salesMap = new Map(salesGroups.map((g) => [g.productId, {
    quantity: g._sum.quantity ?? 0,
    revenue:  Number(g._sum.lineTotal ?? 0),
  }]));

  const active        = summaryGroups.find((g) => g.isActive === true)?._count.id  ?? 0;
  const inactive      = summaryGroups.find((g) => g.isActive === false)?._count.id ?? 0;
  const totalRevenue  = salesGroups.reduce((s, g) => s + Number(g._sum.lineTotal ?? 0), 0);

  return {
    summary: {
      total:        products.length || active + inactive,
      active,
      inactive,
      totalRevenue,
    },
    products: products
      .map((p) => {
        const sales = salesMap.get(p.id) ?? { quantity: 0, revenue: 0 };
        return {
          productId:    p.id,
          productName:  p.nameAr,
          productCode:  p.code,
          unit:         p.unit,
          price:        Number(p.price),
          isActive:     p.isActive,
          quantitySold: sales.quantity,
          revenue:      sales.revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue),
  };
}
