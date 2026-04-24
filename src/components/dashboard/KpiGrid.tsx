import { TrendingUp, TrendingDown, MapPin, ShoppingCart, Users, Target } from "lucide-react";
import { cn, formatSAR, formatNumber, formatPercent } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

function KpiCard({ label, value, change, icon: Icon, iconColor, iconBg }: KpiCardProps) {
  const positive = change >= 0;

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={cn("p-2.5 rounded-card", iconBg)}>
          <Icon size={20} className={iconColor} />
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-badge",
            positive
              ? "bg-success-50 text-success-600"
              : "bg-danger-50 text-danger-600"
          )}
        >
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span className="num">{formatPercent(Math.abs(change))}</span>
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary num">{value}</p>
        <p className="text-sm text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}

const KPI_DATA: KpiCardProps[] = [
  {
    label: "إجمالي المبيعات",
    value: formatSAR(284500),
    change: 12.5,
    icon: ShoppingCart,
    iconColor: "text-brand-600",
    iconBg: "bg-brand-50",
  },
  {
    label: "إجمالي الزيارات",
    value: formatNumber(148),
    change: 8.2,
    icon: MapPin,
    iconColor: "text-success-600",
    iconBg: "bg-success-50",
  },
  {
    label: "عملاء جدد",
    value: formatNumber(23),
    change: -3.1,
    icon: Users,
    iconColor: "text-warning-600",
    iconBg: "bg-warning-50",
  },
  {
    label: "نسبة الإنجاز",
    value: formatPercent(56.9),
    change: 4.7,
    icon: Target,
    iconColor: "text-chart-5",
    iconBg: "bg-purple-50",
  },
];

export default function KpiGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {KPI_DATA.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}
