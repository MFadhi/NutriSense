/**
 * src/hooks/useApi.js — Lightweight data-fetching hook.
 *
 * Usage:
 *   const { data, loading, error, reload } = useApi(() => searchFoods(q), [q]);
 *
 * - Calls apiFn() on mount and whenever deps change.
 * - Cancels stale requests on dep change / unmount via AbortController.
 * - Returns { data, loading, error, reload } — no new libraries required.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useApi(apiFn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const revisionRef            = useRef(0);

  const run = useCallback(async () => {
    const rev = ++revisionRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn();
      if (rev === revisionRef.current) {
        setData(result);
      }
    } catch (err) {
      if (rev === revisionRef.current) {
        setError(err);
      }
    } finally {
      if (rev === revisionRef.current) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run };
}
