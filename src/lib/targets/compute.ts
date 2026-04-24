import type { Achievement, AchievementStatus, TargetMetric } from "@/types";
import { daysElapsed, daysRemaining, percentageOfPeriod } from "./periods";

export interface ComputeInput {
  metric: TargetMetric;
  target: number;
  actual: number;
  periodStart: Date;
  periodEnd: Date;
}

export function computeAchievementMetrics(input: ComputeInput, now: Date): Achievement {
  const { metric, target, actual, periodStart, periodEnd } = input;

  const elapsed   = daysElapsed(periodStart, now);
  const remaining = daysRemaining(periodEnd, now);
  const pctPeriod = percentageOfPeriod(periodStart, periodEnd, now);

  const attainment = target > 0 ? (actual / target) * 100 : 0;

  // Linear projection: if elapsed > 0 extrapolate; else use actual
  const total      = elapsed + remaining;
  const projected  = total > 0 && elapsed > 0
    ? (actual / elapsed) * total
    : actual;

  const projectedAttainment = target > 0 ? (projected / target) * 100 : 0;

  // Status: evaluate projected attainment vs expected pace
  let status: AchievementStatus;
  if (projectedAttainment >= 110) {
    status = "ahead";
  } else if (projectedAttainment < 90) {
    // Below 90% projected — at_risk if still in period, behind if ended
    status = remaining > 0 ? "at_risk" : "behind";
  } else if (attainment < (pctPeriod - 10)) {
    status = "at_risk";
  } else {
    status = "on_track";
  }

  return {
    metric,
    target,
    actual,
    attainment,
    projected,
    projectedAttainment,
    status,
    daysRemaining: remaining,
    daysElapsed: elapsed,
    percentageOfPeriod: pctPeriod,
  };
}
