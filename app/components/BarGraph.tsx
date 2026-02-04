'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface BarGraphProps<T> {
  data: T[];
  xKey: keyof T;
  bars: { dataKey: keyof T; color: string; name: string }[];
  height?: number;
  xFormatter?: (v: any) => string;
}

export default function BarGraph<T extends Record<string, any>>({
  data,
  xKey,
  bars,
  height = 400,
  xFormatter,
}: BarGraphProps<T>) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <XAxis
          dataKey={xKey as string}
          tickFormatter={xFormatter}
          stroke="#5550bd"
        />
        <YAxis stroke="#5550bd" />
        <Tooltip />
        <Legend />
        {bars.map((b) => (
          <Bar
            key={String(b.dataKey)}
            dataKey={b.dataKey as string}
            fill={b.color}
            name={b.name}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
