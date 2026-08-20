import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // "active" = seen in the last 5 minutes

/** Lightweight, approximate presence — not exact, and never exposes location. */
export function useActiveStudentCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const cutoff = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
    const q = query(collection(db, 'users'), where('lastSeen', '>=', cutoff));
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(null));
    return unsub;
  }, []);

  return count;
}
