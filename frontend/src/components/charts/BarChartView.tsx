import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { AXIS, GRID, SINGLE } from './palette';

/** Single-series vertical bars (e.g. paid per month in ONE currency). 4px rounded data-ends, 2px gaps. */
export function BarChartView({ data, format, height = 200, label }: {
  data: { label: string; value: number | null }[];
  format: (v: number) => string;
  height?: number;
  label: string;
}) {
  return (
    <div style={{ height }} className="w-full" aria-label={label} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap={2}>
          <CartesianGrid stroke={GRID} strokeDasharray="4 5" />
          <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 13 }} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tickFormatter={format} tick={{ fill: AXIS, fontSize: 13 }} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={<BarTooltip format={format} />} cursor={{ fill: 'rgb(var(--surface-2))' }} />
          <Bar dataKey="value" fill={SINGLE} radius={[10, 10, 0, 0]} maxBarSize={40} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarTooltip({ active, payload, label, format }: TooltipProps<number, string> & { format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value as number | null;
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-overlay">
      <span className="font-medium">{label}</span> · <span className="tabular">{v === null ? 'No data' : format(v)}</span>
    </div>
  );
}
