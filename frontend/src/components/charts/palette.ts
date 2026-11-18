/**
 * Chart color roles (CSS variables, light + dark set in styles/globals.css). Categorical slots are assigned in a
 * fixed, validated order and follow the entity (account), never its rank. Max four series per chart; beyond that,
 * use small multiples. Slot 3 (aqua) is below 3:1 on light surfaces, so multi-series charts always ship a legend
 * plus direct labels or a table view.
 */
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'] as const;
export const SINGLE = 'var(--series-single)';
export const GRID = 'var(--chart-grid)';
export const AXIS = 'var(--chart-axis)';

export function seriesColor(index: number): string {
  return SERIES[index % SERIES.length]!;
}
