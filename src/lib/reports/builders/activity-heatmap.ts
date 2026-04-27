import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActivityHeatmapFilters, ActivityHeatmapData, HeatmapCell } from "../types";

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export async function buildActivityHeatmap(
  filters: ActivityHeatmapFilters,
  accessibleIds: string[]
): Promise<ActivityHeatmapData> {
  const { from, to, repId } = filters;

  const repIds = repId ? [repId] : accessibleIds;

  // Raw SQL for efficient DOW + hour extraction in Riyadh timezone
  const heatmapRaw = await prisma.$queryRaw<
    Array<{ day_of_week: number; hour: number; count: bigint }>
  >(Prisma.sql`
    SELECT
      EXTRACT(DOW FROM v.visited_at AT TIME ZONE 'Asia/Riyadh')::int  AS day_of_week,
      EXTRACT(HOUR FROM v.visited_at AT TIME ZONE 'Asia/Riyadh')::int AS hour,
      COUNT(*) AS count
    FROM visits v
    WHERE v.rep_id = ANY(${repIds})
      AND v.visited_at >= ${from}
      AND v.visited_at <= ${to}
    GROUP BY day_of_week, hour
    ORDER BY day_of_week, hour
  `);

  const heatmap: HeatmapCell[] = heatmapRaw.map((r) => ({
    dayOfWeek: r.day_of_week,
    hour:      r.hour,
    count:     Number(r.count),
  }));

  // Per-rep total visits
  const repActivityRaw = await prisma.visit.groupBy({
    by:    ["repId"],
    where: { repId: { in: repIds }, visitedAt: { gte: from, lte: to } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 20,
  });

  const repUserIds = repActivityRaw.map((r) => r.repId);
  const repUsers   = repUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: repUserIds } },
        select: { id: true, name: true },
      })
    : [];
  const repNameMap = new Map(repUsers.map((u) => [u.id, u.name]));

  const repActivity = repActivityRaw.map((r) => ({
    repId:       r.repId,
    repName:     repNameMap.get(r.repId) ?? null,
    totalVisits: r._count.id,
  }));

  // Peak detection
  let peakDay  = 0;
  let peakHour = 0;
  let peakCount = 0;
  const dayTotals  = new Array<number>(7).fill(0);
  const hourTotals = new Array<number>(24).fill(0);

  for (const cell of heatmap) {
    dayTotals[cell.dayOfWeek]  = (dayTotals[cell.dayOfWeek]  ?? 0) + cell.count;
    hourTotals[cell.hour]      = (hourTotals[cell.hour]      ?? 0) + cell.count;
    if (cell.count > peakCount) {
      peakCount = cell.count;
      peakDay   = cell.dayOfWeek;
      peakHour  = cell.hour;
    }
  }

  const totalVisits = repActivity.reduce((s, r) => s + r.totalVisits, 0);

  void DAY_LABELS; // used in UI

  return { heatmap, repActivity, peakDay, peakHour, totalVisits };
}
