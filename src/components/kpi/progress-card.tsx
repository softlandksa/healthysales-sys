"use client";

import { cn, formatPercent } from "@/lib/utils";
import {
  ACHIEVEMENT_STATUS_LABELS,
  TARGET_METRIC_LABELS,
  type Achievement,
} from "@/types";

interface ProgressCardProps {
  achievement: Achievement;
  valueFormatter?: (n: number) => string;
}

const STATUS_COLORS: Record<string, string> = {
  ahead:    "text-success-600 bg-success-50",
  on_track: "text-warning-600 bg-warning-50",
  at_risk:  "text-warning-600 bg-warning-50",
  behind:   "text-danger-600 bg-danger-50",
};

const BAR_COLORS: Record<string, string> = {
  ahead:    "bg-success-500",
  on_track: "bg-brand-500",
  at_risk:  "bg-warning-500",
  behind:   "bg-danger-500",
};

export function ProgressCard({ achievement, valueFormatter }: ProgressCardProps) {
  const {
    metric, attainment, status, daysRemaining, actual, target,
  } = achievement;

  const fmt     = valueFormatter ?? ((n) => n.toLocaleString("en-US", { maximumFractionDigits: 0 }));
  const barPct  = Math.min(100, Math.max(0, attainment));

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-secondary">{TARGET_METRIC_LABELS[metric]}</p>
        <span
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-badge",
            STATUS_COLORS[status] ?? "text-text-secondary bg-neutral-100"
          )}
        >
          {ACHIEVEMENT_STATUS_LABELS[status]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-end justify-between">
          <span className="text-xl font-bold text-text-primary num">{fmt(actual)}</span>
          <span className="text-sm text-text-secondary num">/ {fmt(target)}</span>
        </div>

        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", BAR_COLORS[status] ?? "bg-brand-500")}
            style={{ width: `${barPct}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-text-secondary">
          <span className="num">{formatPercent(attainment, 0)} إنجاز</span>
          <span>باقي <span className="num">{daysRemaining}</span> يوم</span>
        </div>
      </div>
    </div>
  );
}
