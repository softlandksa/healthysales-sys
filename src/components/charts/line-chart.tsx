"use client";

import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface LineSeries {
  key: string;
  label: string;
  color: string;
}

interface LineChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: LineSeries[];
  height?: number;
  valueFormatter?: (v: number) => string;
}

export function LineChart({ data, xKey, series, height = 240, valueFormatter }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLine data={data}>
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
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </RechartsLine>
    </ResponsiveContainer>
  );
}
