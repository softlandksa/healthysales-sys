"use client";

import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface BarSeries {
  key: string;
  label: string;
  color: string;
}

interface BarChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: BarSeries[];
  height?: number;
  valueFormatter?: (v: number) => string;
}

export function BarChart({ data, xKey, series, height = 240, valueFormatter }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar data={data} barSize={20}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          {...(valueFormatter ? { tickFormatter: valueFormatter } : {})}
          width={60}
        />
        <Tooltip
          {...(valueFormatter ? { formatter: (val: number) => [valueFormatter(val)] } : {})}
          contentStyle={{ borderRadius: 8, fontSize: 13, border: "1px solid #e5e7eb" }}
        />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
        ))}
      </RechartsBar>
    </ResponsiveContainer>
  );
}
