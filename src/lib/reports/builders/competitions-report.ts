import { prisma } from "@/lib/db/prisma";
import type { CompetitionsReportFilters, CompetitionsReportData } from "../types";

export async function buildCompetitionsReport(
  filters: CompetitionsReportFilters,
): Promise<CompetitionsReportData> {
  const { from, to, status } = filters;

  const competitions = await prisma.competition.findMany({
    where: {
      ...(status ? { status: status as "upcoming" | "active" | "ended" | "cancelled" } : {}),
      OR: [
        { startDate: { gte: from, lte: to } },
        { endDate:   { gte: from, lte: to } },
        { startDate: { lte: from }, endDate: { gte: to } },
      ],
    },
    select: {
      id: true, name: true, status: true,
      startDate: true, endDate: true, prize: true,
      product: { select: { nameAr: true } },
      salesOrders: { select: { id: true, repId: true }, distinct: ["repId"] },
      results: {
        select: {
          rank: true,
          user: { select: { name: true } },
        },
        orderBy: { rank: "asc" },
        take: 3,
      },
    },
    orderBy: { startDate: "desc" },
    take: 100,
  });

  const historyRows = competitions.map((c) => ({
    id:               c.id,
    name:             c.name,
    status:           c.status,
    startDate:        c.startDate,
    endDate:          c.endDate,
    prize:            c.prize,
    productName:      c.product.nameAr,
    participantCount: c.salesOrders.length,
    winners:          c.results.map((r) => ({ rank: r.rank, name: r.user.name })),
  }));

  // Top winners (most rank=1 wins)
  const winnerGroups = await prisma.competitionResult.groupBy({
    by:    ["userId"],
    where: {
      rank: 1,
      competition: {
        OR: [
          { startDate: { gte: from, lte: to } },
          { endDate:   { gte: from, lte: to } },
        ],
      },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const winnerIds  = winnerGroups.map((g) => g.userId);
  const winnerUsers = winnerIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: winnerIds } },
        select: { id: true, name: true },
      })
    : [];
  const winnerNameMap = new Map(winnerUsers.map((u) => [u.id, u.name]));

  const topWinners = winnerGroups.map((g) => ({
    userId: g.userId,
    name:   winnerNameMap.get(g.userId) ?? null,
    wins:   g._count.id,
  }));

  const [active, ended] = await Promise.all([
    prisma.competition.count({ where: { status: "active" } }),
    prisma.competition.count({ where: { status: "ended" } }),
  ]);

  return {
    competitions: historyRows,
    topWinners,
    summary: {
      total:  competitions.length,
      active,
      ended,
    },
  };
}
