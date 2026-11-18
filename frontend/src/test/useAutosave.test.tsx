import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from '@/hooks/useAutosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAutosave', () => {
  it('debounces, saves the latest value and reports saved', async () => {
    const save = vi.fn(async () => {});
    const { result, rerender } = renderHook(({ v }) => useAutosave(v, save, { delayMs: 500 }), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' });
    rerender({ v: 'abc' });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('abc');
    expect(result.current.state).toBe('saved');
  });

  it('exposes errors and retries on demand', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(({ v }) => useAutosave(v, save, { delayMs: 100 }), { initialProps: { v: 'x' } });
    rerender({ v: 'xy' });
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(result.current.state).toBe('error');
    await act(async () => { await result.current.retry(); });
    expect(result.current.state).toBe('saved');
    expect(save).toHaveBeenCalledTimes(2);
  });
});
