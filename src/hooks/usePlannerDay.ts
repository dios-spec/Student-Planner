import { useEffect, useState } from 'react';
import { watchPlannerItemsForDate, watchMyCompletions } from '../firebase/planner';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { PlannerItem } from '../types';

export function usePlannerDay(classId: string, dateKey: string, uid: string | undefined) {
  const { data: items, loading } = useCachedSnapshot<PlannerItem[]>(
    `plannerDay:${classId}:${dateKey}`,
    (cb) => watchPlannerItemsForDate(classId, dateKey, cb)
  );

  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!uid) return;
    return watchMyCompletions(uid, setCompletions);
  }, [uid]);

  return { items, completions, loading };
}
