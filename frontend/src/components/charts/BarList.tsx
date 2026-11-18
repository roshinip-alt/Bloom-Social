import { formatMetric } from '@/utils/format';
import type { Unit } from '@/types/api';

/**
 * Horizontal share bars for one dimension (age, country…). Every row is labelled with its value and share, so the
 * information never depends on color or hover.
 */
export function BarList({ items, unit, limit = 8 }: { items: { key: string; label: string; value: number; sharePercent: number | null }[]; unit: Unit | null; limit?: number }) {
  const shown = items.slice(0, limit);
  const max = Math.max(...shown.map((i) => i.sharePercent ?? 0), 1);
  return (
    <ul className="space-y-1.5">
      {shown.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(64px,120px)_1fr_auto] items-center gap-2 text-xs">
          <span className="truncate text-fg-2">{i.label}</span>
          <span className="h-2 overflow-hidden rounded-sm bg-surface-2" aria-hidden>
            <span className="block h-full rounded-sm" style={{ width: `${((i.sharePercent ?? 0) / max) * 100}%`, background: 'var(--series-single)' }} />
          </span>
          <span className="tabular w-24 text-right">
            {i.sharePercent !== null && <span className="font-medium">{i.sharePercent.toFixed(1)}%</span>}
            {unit !== 'PERCENT' && <span className="ml-1 text-fg-3">{formatMetric(i.value, unit)}</span>}
          </span>
        </li>
      ))}
      {items.length > limit && <li className="text-2xs text-fg-3">+ {items.length - limit} more not shown</li>}
    </ul>
  );
}
