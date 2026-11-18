import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { Unit } from '@/types/api';
import { formatDay } from '@/utils/dates';
import { formatMetric } from '@/utils/format';
import { AXIS, GRID, SINGLE, seriesColor } from './palette';

export interface TrendSeries {
  key: string;
  label: string;
  points: { date: string; value: number | null }[];
}

/**
 * Line chart over calendar days, one axis only. Missing days are gaps (connectNulls=false), never drawn as zero.
 * Crosshair tooltip lists every series at the hovered date.
 */
export function TrendChart({ series, unit, height = 220 }: { series: TrendSeries[]; unit: Unit; height?: number }) {
  const dates = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.date)))).sort();
  const rows = dates.map((date) => {
    const row: Record<string, number | string | null> = { date };
    for (const s of series) row[s.key] = s.points.find((p) => p.date === date)?.value ?? null;
    return row;
  });
  const single = series.length === 1;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatDay(d)}
            tick={{ fill: AXIS, fontSize: 13 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => formatMetric(v, unit)}
            tick={{ fill: AXIS, fontSize: 13 }}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<TrendTooltip series={series} unit={unit} />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              type="monotone"
              stroke={single ? SINGLE : seriesColor(i)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendTooltip({ active, payload, label, series, unit }: TooltipProps<number, string> & { series: TrendSeries[]; unit: Unit }) {
  if (!active || !payload || !label) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-2 text-xs shadow-overlay">
      <p className="mb-1 font-medium">{formatDay(String(label), 'EEE d MMM yyyy')}</p>
      {series.map((s, i) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        const value = entry?.value as number | null | undefined;
        return (
          <p key={s.key} className="flex items-center gap-1.5 text-fg-2">
            {series.length > 1 && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: seriesColor(i) }} />}
            <span className="flex-1">{s.label}</span>
            <span className="tabular font-medium text-fg">{value === null || value === undefined ? 'No data' : formatMetric(value, unit, false)}</span>
          </p>
        );
      })}
    </div>
  );
}
