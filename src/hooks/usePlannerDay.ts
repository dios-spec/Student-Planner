import { useEffect, useState } from 'react';
import { watchPlannerItemsForDate, watchMyCompletions } from '../firebase/planner';
import type { PlannerItem } from '../types';

export function usePlannerDay(dateKey: string, uid: string | undefined) {
  const [items, setItems] = useState<PlannerItem[] | null>(null);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setItems(null);
    const unsub = watchPlannerItemsForDate(dateKey, setItems);
    return unsub;
  }, [dateKey]);

  useEffect(() => {
    if (!uid) return;
    const unsub = watchMyCompletions(uid, setCompletions);
    return unsub;
  }, [uid]);

  return { items, completions, loading: items === null };
}
