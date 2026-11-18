import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** A string value kept in the URL query (shareable filters, back-button friendly). */
export function useUrlState(key: string, fallback: string): [string, (value: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const set = useCallback(
    (next: string | null) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === null || next === '' || next === fallback) p.delete(key);
          else p.set(key, next);
          return p;
        },
        { replace: true },
      );
    },
    [key, fallback, setParams],
  );
  return [value, set];
}
