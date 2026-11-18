import { describe, expect, it } from 'vitest';
import { formatChange, formatCurrency, formatMetric, NOT_AVAILABLE } from '@/utils/format';
import { availabilityText } from '@/utils/labels';
import { monthGrid, shiftDate } from '@/utils/dates';

describe('metric formatting', () => {
  it('never renders a missing value as zero', () => {
    expect(formatMetric(null, 'COUNT')).toBe(NOT_AVAILABLE);
    expect(formatMetric(undefined, 'PERCENT')).toBe(NOT_AVAILABLE);
    expect(formatMetric(0, 'COUNT')).toBe('0');
  });

  it('formats units', () => {
    expect(formatMetric(12.345, 'PERCENT')).toBe('12.3%');
    expect(formatMetric(125, 'SECONDS')).toBe('2:05');
    expect(formatMetric(45, 'MINUTES')).toBe('45 min');
  });

  it('describes change only when there is something to compare', () => {
    expect(formatChange(null, 100, 'COUNT')).toBeNull();
    expect(formatChange(10, 100, 'COUNT')).toMatchObject({ direction: 'up', percent: '+10%' });
    expect(formatChange(-5, 0, 'COUNT')).toMatchObject({ direction: 'down', percent: null });
  });

  it('formats money in the record currency', () => {
    expect(formatCurrency(1500, 'EUR')).toContain('1,500');
    expect(formatCurrency(null, 'USD')).toBe(NOT_AVAILABLE);
  });

  it('explains unavailable metrics per platform', () => {
    expect(availabilityText('NOT_SUPPORTED', 'TIKTOK')).toBe("Not available from TikTok's API");
    expect(availabilityText('BEFORE_HISTORY')).toMatch(/not invented/);
  });
});

describe('calendar dates', () => {
  it('builds Monday-first month grids of whole weeks', () => {
    const grid = monthGrid('2026-02-10');
    expect(grid[0]).toBe('2026-01-26');
    expect(grid.length % 7).toBe(0);
    expect(grid).toContain('2026-02-28');
  });

  it('shifts calendar dates without timezone drift', () => {
    expect(shiftDate('2026-03-28', 2)).toBe('2026-03-30'); // across a DST change in Europe
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  });
});
