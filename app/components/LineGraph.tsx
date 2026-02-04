'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface LineGraphProps<T> {
  data: T[];
  xKey: keyof T;
  lines: { dataKey: keyof T; color: string; name: string }[];
  height?: number;
  xFormatter?: (value: any) => string;
}

export default function LineGraph<T extends Record<string, any>>({
  data,
  xKey,
  lines,
  height = 400,
  xFormatter,
}: LineGraphProps<T>) {
  // Calculate Y-axis min/max with padding
  const yValues: number[] = [];
  data.forEach((row) => {
    lines.forEach((l) => {
      const value = Number(row[l.dataKey]);
      if (!isNaN(value)) yValues.push(value);
    });
  });

  const yMin = yValues.length ? Math.min(...yValues) : 0;
  const yMax = yValues.length ? Math.max(...yValues) : 1;
  const padding = (yMax - yMin) * 0.1 || 1; // 10% padding or 1 if all 0

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data.length ? data : [{ [xKey]: '', [lines[0].dataKey]: 0 }]}
      >
        <XAxis
          dataKey={xKey as string}
          tickFormatter={xFormatter}
          stroke="#5550bd"
        />
        <YAxis domain={[yMin - padding, yMax + padding]} stroke="#5550bd" />
        <Tooltip />
        <Legend />
        {lines.map((l) => (
          <Line
            key={String(l.dataKey)}
            type="monotone"
            dataKey={l.dataKey as string}
            stroke={l.color}
            name={l.name}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
