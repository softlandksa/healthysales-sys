import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";

interface SparklinePoint {
  value: number;
}

interface StatCardProps {
  label: string;
  value: string;
  delta?: number;          // % change vs previous period; omit to hide
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  sparkline?: SparklinePoint[];
}

function MiniSparkline({ points }: { points: SparklinePoint[] }) {
  if (points.length < 2) return null;
  const vals   = points.map((p) => p.value);
  const min    = Math.min(...vals);
  const max    = Math.max(...vals);
  const range  = max - min || 1;
  const w      = 60;
  const h      = 24;
  const pts    = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand-400"
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  iconColor,
  iconBg,
  sparkline,
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0;

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={cn("p-2.5 rounded-card", iconBg)}>
          <Icon size={20} className={iconColor} />
        </div>

        <div className="flex items-center gap-2">
          {sparkline && <MiniSparkline points={sparkline} />}

          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-badge",
                positive
                  ? "bg-success-50 text-success-600"
                  : "bg-danger-50 text-danger-600"
              )}
            >
              {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="num">{formatPercent(Math.abs(delta))}</span>
            </span>
          )}
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold text-text-primary num">{value}</p>
        <p className="text-sm text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}
