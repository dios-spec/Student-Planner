import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CompletionRecord } from '../types';

/** Separate small listener on the same completionStatus collection, scoped
 * to just the `important` field -- kept independent of watchMyCompletions
 * so that hook's existing return shape (used across Planner) is untouched. */
export function useMyImportant(userId: string | undefined) {
  const [importantSet, setImportantSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) { setImportantSet(new Set()); return; }
    const q = query(collection(db, 'completionStatus'), where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      const set = new Set<string>();
      snap.docs.forEach((d) => {
        const data = d.data() as CompletionRecord;
        if (data.important) set.add(data.itemId);
      });
      setImportantSet(set);
    });
  }, [userId]);

  return importantSet;
}
