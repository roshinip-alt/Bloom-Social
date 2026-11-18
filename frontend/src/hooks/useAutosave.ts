import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Debounced autosave. Saves `value` `delayMs` after the last change, never runs two saves at once, and exposes the
 * state for "Saving… / Saved / Couldn't save" feedback plus a manual retry.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, { delayMs = 800, enabled = true } = {}) {
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<unknown>(null);
  const latest = useRef(value);
  const saved = useRef(value);
  const inFlight = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  latest.current = value;

  const flush = useCallback(async () => {
    if (inFlight.current || Object.is(latest.current, saved.current)) return;
    inFlight.current = true;
    const snapshot = latest.current;
    let failed = false;
    setState('saving');
    try {
      await saveRef.current(snapshot);
      saved.current = snapshot;
      setError(null);
      setState('saved');
    } catch (e) {
      failed = true;
      setError(e);
      setState('error');
    } finally {
      inFlight.current = false;
    }
    // Only follow up when the user typed during the save. After a failure we wait for the next edit or an
    // explicit retry, so an offline server is not hammered in a loop.
    if (!failed && !Object.is(latest.current, snapshot)) void flush();
  }, []);

  useEffect(() => {
    if (!enabled || Object.is(value, saved.current)) return;
    const t = window.setTimeout(() => void flush(), delayMs);
    return () => window.clearTimeout(t);
  }, [value, enabled, delayMs, flush]);

  /** Marks `v` as the persisted baseline (e.g. after loading a new day). */
  const reset = useCallback((v: T) => {
    saved.current = v;
    latest.current = v;
    setState('idle');
    setError(null);
  }, []);

  return { state, error, retry: flush, reset };
}
