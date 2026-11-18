import type { Unit } from '@/types/api';

/**
 * Number formatting for metrics. `null`/`undefined` always renders as an em dash — an unavailable value is never
 * shown as 0. Callers add the reason (see `availabilityText`).
 */
export const NOT_AVAILABLE = '—';

export function formatNumber(value: number | null | undefined, options: Intl.NumberFormatOptions = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, ...options }).format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return Math.abs(value) < 10_000
    ? formatNumber(value, { maximumFractionDigits: 0 })
    : formatNumber(value, { notation: 'compact', maximumFractionDigits: 1 });
}

export function formatMetric(value: number | null | undefined, unit: Unit | null | undefined, compact = true): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  switch (unit) {
    case 'PERCENT':
      return `${formatNumber(value, { maximumFractionDigits: 1 })}%`;
    case 'MINUTES':
      return value >= 600 ? `${formatCompact(value / 60)} h` : `${formatNumber(value, { maximumFractionDigits: 0 })} min`;
    case 'SECONDS':
      return formatDuration(value);
    default:
      return compact ? formatCompact(value) : formatNumber(value, { maximumFractionDigits: 0 });
  }
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return NOT_AVAILABLE;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${m}:${String(rest).padStart(2, '0')}`;
}

export function formatCurrency(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${formatNumber(value, { maximumFractionDigits: 2 })} ${currency}`;
  }
}

/** Signed change with direction, e.g. "+1,240" / "−3.2%". Returns null when there is nothing to compare. */
export function formatChange(change: number | null | undefined, previous: number | null | undefined, unit: Unit): {
  text: string;
  percent: string | null;
  direction: 'up' | 'down' | 'flat';
} | null {
  if (change === null || change === undefined) return null;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  const percent = previous ? `${sign}${formatNumber(Math.abs((change / previous) * 100), { maximumFractionDigits: 1 })}%` : null;
  return { text: `${sign}${formatMetric(Math.abs(change), unit)}`, percent, direction };
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count, { maximumFractionDigits: 0 })} ${count === 1 ? singular : plural}`;
}
