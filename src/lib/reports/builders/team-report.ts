import { prisma } from "@/lib/prisma";
import type { TeamReportFilters, TeamReportData, TeamSummaryRow, RepCompareRow } from "../types";

export async function buildTeamReport(
  filters: TeamReportFilters,
  accessibleIds: string[]
): Promise<TeamReportData> {
  const { from, to, teamId } = filters;

  // Get accessible teams
  const teamWhere = teamId ? { id: teamId } : undefined;

  const teams = await prisma.team.findMany({
    where: {
      ...teamWhere,
      members: { some: { id: { in: accessibleIds } } },
    },
    select: {
      id: true,
      nameAr: true,
      members: {
        where: { id: { in: accessibleIds }, role: "sales_rep" },
        select: { id: true, name: true },
      },
    },
  });

  if (teams.length === 0) {
    return { teams: [], reps: [] };
  }

  const allRepIds = teams.flatMap((t) => t.members.map((m) => m.id));

  // Aggregate per rep
  const [salesGroups, collGroups, visitGroups] = await Promise.all([
    prisma.salesOrder.groupBy({
      by:    ["repId"],
      where: { repId: { in: allRepIds }, status: "collected", collectedAt: { gte: from, lte: to } },
      _sum:  { total: true },
    }),
    prisma.collection.groupBy({
      by:    ["repId"],
      where: { repId: { in: allRepIds }, isCancelled: false, collectedAt: { gte: from, lte: to } },
      _sum:  { amount: true },
    }),
    prisma.visit.groupBy({
      by:    ["repId"],
      where: { repId: { in: allRepIds }, visitedAt: { gte: from, lte: to } },
      _count: { id: true },
    }),
  ]);

  const salesMap = new Map(salesGroups.map((g) => [g.repId, Number(g._sum.total ?? 0)]));
  const collMap  = new Map(collGroups.map((g) => [g.repId, Number(g._sum.amount ?? 0)]));
  const visitMap = new Map(visitGroups.map((g) => [g.repId, g._count.id]));

  const reps: RepCompareRow[] = [];
  const teamRows: TeamSummaryRow[] = [];

  for (const team of teams) {
    let teamSales = 0, teamColl = 0, teamVisits = 0;

    for (const member of team.members) {
      const s = salesMap.get(member.id) ?? 0;
      const c = collMap.get(member.id)  ?? 0;
      const v = visitMap.get(member.id) ?? 0;
      teamSales  += s;
      teamColl   += c;
      teamVisits += v;

      reps.push({
        repId:       member.id,
        repName:     member.name,
        teamId:      team.id,
        teamName:    team.nameAr,
        sales:       s,
        collections: c,
        visits:      v,
      });
    }

    teamRows.push({
      teamId:      team.id,
      teamName:    team.nameAr,
      sales:       teamSales,
      collections: teamColl,
      visits:      teamVisits,
      repCount:    team.members.length,
    });
  }

  teamRows.sort((a, b) => b.sales - a.sales);
  reps.sort((a, b) => b.sales - a.sales);

  return { teams: teamRows, reps };
}
