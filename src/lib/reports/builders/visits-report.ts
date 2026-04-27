import { prisma } from "@/lib/prisma";
import type { VisitType } from "@prisma/client";
import type { VisitsReportFilters, VisitsReportData } from "../types";

export async function buildVisitsReport(
  filters: VisitsReportFilters,
  accessibleIds: string[]
): Promise<VisitsReportData> {
  const repFilter = filters.repId ? [filters.repId] : accessibleIds;

  const baseWhere = {
    repId:     { in: repFilter },
    visitedAt: { gte: filters.from, lte: filters.to },
    ...(filters.visitType ? { visitType: filters.visitType as VisitType } : {}),
  };

  const [visitsR, uniqueCustomersR, byRepTypeR, byTypeR] = await Promise.allSettled([
    prisma.visit.findMany({
      where: baseWhere,
      select: {
        id: true, visitedAt: true, visitType: true, notes: true,
        customer: { select: { nameAr: true } },
        rep:      { select: { name: true } },
      },
      orderBy: { visitedAt: "desc" },
      take: 500,
    }),
    prisma.visit.groupBy({
      by:    ["customerId"],
      where: { repId: { in: repFilter }, visitedAt: { gte: filters.from, lte: filters.to } },
    }),
    prisma.visit.groupBy({
      by:    ["repId", "visitType"],
      where: baseWhere,
      _count: { id: true },
    }),
    prisma.visit.groupBy({
      by:    ["visitType"],
      where: { repId: { in: repFilter }, visitedAt: { gte: filters.from, lte: filters.to } },
      _count: { id: true },
    }),
  ] as const);

  const visits          = visitsR.status          === "fulfilled" ? visitsR.value          : [];
  const uniqueCustomers = uniqueCustomersR.status === "fulfilled" ? uniqueCustomersR.value.length : 0;
  const byRepTypeGroups = byRepTypeR.status       === "fulfilled" ? byRepTypeR.value       : [];
  const byTypeGroups    = byTypeR.status          === "fulfilled" ? byTypeR.value          : [];

  // Aggregate per rep
  const repAggMap = new Map<string, { visitOnly: number; sale: number; collection: number }>();
  for (const g of byRepTypeGroups) {
    const cur = repAggMap.get(g.repId) ?? { visitOnly: 0, sale: 0, collection: 0 };
    const n   = g._count.id;
    if (g.visitType === "visit_only") cur.visitOnly  += n;
    else if (g.visitType === "sale")  cur.sale       += n;
    else                              cur.collection += n;
    repAggMap.set(g.repId, cur);
  }

  const repIds = [...repAggMap.keys()];
  const repUsers = repIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true } }).catch(() => [])
    : [];
  const repNameMap = new Map(repUsers.map((u) => [u.id, u.name]));

  const totalCount = byTypeGroups.reduce((s, g) => s + g._count.id, 0);
  const totalDays  = Math.max(1, Math.ceil((filters.to.getTime() - filters.from.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    summary: {
      total:           totalCount,
      uniqueCustomers: uniqueCustomers,
      avgPerDay:       totalCount / totalDays,
      visitOnly:       byTypeGroups.find((g) => g.visitType === "visit_only")?._count.id ?? 0,
      sale:            byTypeGroups.find((g) => g.visitType === "sale")?._count.id       ?? 0,
      collection:      byTypeGroups.find((g) => g.visitType === "collection")?._count.id ?? 0,
    },
    byRep: [...repAggMap.entries()]
      .map(([repId, agg]) => ({
        repId,
        repName:    repNameMap.get(repId) ?? null,
        total:      agg.visitOnly + agg.sale + agg.collection,
        visitOnly:  agg.visitOnly,
        sale:       agg.sale,
        collection: agg.collection,
      }))
      .sort((a, b) => b.total - a.total),
    visits: visits.map((v) => ({
      id:           v.id,
      visitedAt:    v.visitedAt,
      customerName: v.customer.nameAr,
      repName:      v.rep.name,
      visitType:    v.visitType,
      notes:        v.notes,
    })),
  };
}
