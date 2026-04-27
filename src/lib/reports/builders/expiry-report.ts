import { prisma } from "@/lib/prisma";
import type { ExpiryReportFilters, ExpiryReportData, ExpiryStatus, ExpiryItemRow } from "../types";

function expiryStatus(daysUntilExpiry: number): ExpiryStatus {
  if (daysUntilExpiry < 0)   return "expired";
  if (daysUntilExpiry < 30)  return "critical";
  if (daysUntilExpiry < 90)  return "warning";
  return "fresh";
}

export async function buildExpiryReport(
  filters: ExpiryReportFilters,
  accessibleIds: string[]
): Promise<ExpiryReportData> {
  const { from, to, repId, status } = filters;

  const now = new Date();

  // Query order items with expiry info — all delivered/collected orders in range
  const items = await prisma.salesOrderItem.findMany({
    where: {
      order: {
        repId:  repId ? repId : { in: accessibleIds },
        status: { in: ["delivered", "collected"] },
        createdAt: { gte: from, lte: to },
      },
    },
    select: {
      id:        true,
      quantity:  true,
      expiryDate: true,
      order: {
        select: {
          id:   true,
          code: true,
          rep: { select: { id: true, name: true } },
        },
      },
      product: { select: { id: true, code: true, nameAr: true } },
    },
    orderBy: { expiryDate: "asc" },
    take: 1000, // cap for performance
  });

  const rows: ExpiryItemRow[] = items
    .map((item) => {
      const expiry = item.expiryDate;
      const diffMs = expiry.getTime() - now.getTime();
      const days   = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const s      = expiryStatus(days);
      return {
        orderItemId:     item.id,
        orderId:         item.order.id,
        orderCode:       item.order.code,
        productId:       item.product.id,
        productName:     item.product.nameAr,
        productCode:     item.product.code,
        repId:           item.order.rep.id,
        repName:         item.order.rep.name,
        quantity:        item.quantity,
        expiryDate:      expiry,
        daysUntilExpiry: days,
        status:          s,
      };
    })
    .filter((r) => !status || r.status === status);

  const summary: Record<ExpiryStatus, number> = {
    fresh:    0,
    warning:  0,
    critical: 0,
    expired:  0,
  };
  for (const row of rows) summary[row.status]++;

  return { items: rows, summary };
}
