"use client";

import { cn } from "@/lib/utils";
import { TARGET_METRIC_LABELS, type Achievement, type TargetMetric } from "@/types";

interface HeatmapEntry {
  userId: string;
  userName: string | null;
  achievements: Achievement[];
}

interface AttainmentHeatmapProps {
  entries: HeatmapEntry[];
  metrics?: TargetMetric[];
}

const METRICS: TargetMetric[] = ["sales_amount", "collections_amount", "visits_count"];

function attainmentColor(pct: number): string {
  if (pct >= 100) return "bg-success-500 text-white";
  if (pct >= 80)  return "bg-success-200 text-success-800";
  if (pct >= 60)  return "bg-warning-200 text-warning-800";
  if (pct >= 40)  return "bg-warning-100 text-warning-700";
  return "bg-danger-100 text-danger-700";
}

export function AttainmentHeatmap({ entries, metrics = METRICS }: AttainmentHeatmapProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-text-secondary text-center py-8">لا توجد بيانات</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-right py-2 px-3 text-text-secondary font-medium">المندوب</th>
            {metrics.map((m) => (
              <th key={m} className="text-center py-2 px-3 text-text-secondary font-medium whitespace-nowrap">
                {TARGET_METRIC_LABELS[m]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const achMap = new Map(entry.achievements.map((a) => [a.metric, a]));
            return (
              <tr key={entry.userId} className="border-t border-border">
                <td className="py-2 px-3 text-text-primary font-medium truncate max-w-[140px]">
                  {entry.userName ?? "—"}
                </td>
                {metrics.map((m) => {
                  const ach = achMap.get(m);
                  const pct = ach ? Math.round(ach.attainment) : null;
                  return (
                    <td key={m} className="py-2 px-3 text-center">
                      {pct !== null ? (
                        <span
                          className={cn(
                            "inline-block min-w-12 px-2 py-0.5 rounded-badge text-xs font-semibold num",
                            attainmentColor(pct)
                          )}
                        >
                          {pct}%
                        </span>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
