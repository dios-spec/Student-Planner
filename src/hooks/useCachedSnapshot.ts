import { useEffect, useRef, useState } from 'react';

// Module-level cache that survives component unmounts (tab switches).
// Keyed by a stable string; stores the last data each listener produced so
// re-opening a tab shows it instantly instead of a skeleton.
const cache = new Map<string, unknown>();

type Subscribe<T> = (cb: (data: T) => void) => () => void;

/**
 * Subscribe to a realtime source, but seed initial state from the last cached
 * value for this key so returning to a tab is instant. `loading` is only true
 * the very first time a key is seen (no cache yet).
 */
export function useCachedSnapshot<T>(key: string, subscribe: Subscribe<T>) {
  const [data, setData] = useState<T | null>(() => (cache.has(key) ? (cache.get(key) as T) : null));
  const keyRef = useRef(key);

  useEffect(() => {
    // If the key changed (e.g. switched class), immediately swap to that key's cache.
    if (keyRef.current !== key) {
      keyRef.current = key;
      setData(cache.has(key) ? (cache.get(key) as T) : null);
    }
    const unsub = subscribe((d) => {
      cache.set(key, d);
      setData(d);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading: data === null };
}

/** Clears the whole cache — call on sign-out / profile reset if you add one. */
export function clearSnapshotCache() {
  cache.clear();
}
