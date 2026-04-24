/**
 * LEADERBOARD SQL REFERENCE
 * ─────────────────────────────────────────────────────────────────────────────
 * This file documents the raw SQL used for competition leaderboard queries.
 * The actual implementation uses Prisma.$queryRaw with this template.
 *
 * Required indexes (created in migration 20250423000003):
 *
 *   CREATE INDEX sales_order_competition_collected_idx
 *     ON "sales_orders" (competition_id, status, collected_at)
 *     WHERE competition_id IS NOT NULL AND status = 'collected';
 *
 *   CREATE INDEX sales_order_item_product_order_idx
 *     ON "sales_order_items" (product_id, order_id);
 *
 * Query (parameterised):
 *
 *   SELECT
 *     so.rep_id                                        AS "userId",
 *     u.name,
 *     t.name_ar                                        AS team,
 *     COALESCE(SUM(soi.quantity), 0)::int              AS units,
 *     COALESCE(SUM(soi.quantity * soi.unit_price), 0)  AS value,
 *     MAX(so.collected_at)                             AS "lastCollectedAt",
 *     u.is_active                                      AS "isActive"
 *   FROM sales_orders so
 *   JOIN sales_order_items soi
 *     ON soi.order_id = so.id
 *    AND soi.product_id = $competitionProductId
 *   JOIN users u
 *     ON u.id = so.rep_id
 *   LEFT JOIN teams t
 *     ON t.id = u.team_id
 *   WHERE so.competition_id = $competitionId
 *     AND so.status          = 'collected'
 *     AND so.collected_at   >= $startDate
 *     AND so.collected_at    < $endBound        -- endDate + 1 day (exclusive)
 *     AND so.rep_id = ANY($eligibleRepIds)
 *   GROUP BY so.rep_id, u.name, t.name_ar, u.is_active
 *   ORDER BY units DESC, value DESC, MIN(so.collected_at) ASC
 *   LIMIT $limit;
 *
 * Scoring rules recap:
 *   - Only status='collected' orders count (cancelled/refunded orders are excluded).
 *   - Only items matching competition.productId count (one product per competition).
 *   - Only reps within the competition creator's org subtree appear.
 *   - Tie-breaker 1: total collected value of those items.
 *   - Tie-breaker 2: earliest collectedAt of the rep's qualifying orders.
 */

// Re-export the status helper for convenience.
export { computeCompetitionStatus, competitionEndBound } from "./status";
