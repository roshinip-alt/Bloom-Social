import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shiftDate, todayLocal } from '@/utils/dates';

export type RangePreset = '7d' | '28d' | '90d' | 'custom';
const PRESETS: RangePreset[] = ['7d', '28d', '90d', 'custom'];

/**
 * Shared, URL-backed date range. Presets end yesterday because provider reports for "today" are never complete;
 * `custom` uses explicit from/to. All three params change in one navigation so they never race.
 */
export function useDateRange(defaultPreset: RangePreset = '28d') {
  const [params, setParams] = useSearchParams();
  const raw = params.get('range');
  const preset: RangePreset = PRESETS.includes(raw as RangePreset) ? (raw as RangePreset) : defaultPreset;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const range = useMemo(() => {
    if (preset === 'custom' && from && to && from <= to) return { from, to };
    const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 28;
    const end = shiftDate(todayLocal(), -1);
    return { from: shiftDate(end, -(days - 1)), to: end };
  }, [preset, from, to]);

  const update = useCallback(
    (next: { range: RangePreset; from?: string; to?: string }) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('range', next.range);
          if (next.range === 'custom' && next.from && next.to) {
            p.set('from', next.from);
            p.set('to', next.to);
          } else {
            p.delete('from');
            p.delete('to');
          }
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  return {
    preset,
    range,
    setPreset: (p: RangePreset) => update({ range: p }),
    setCustom: (f: string, t: string) => update({ range: 'custom', from: f, to: t }),
  };
}
