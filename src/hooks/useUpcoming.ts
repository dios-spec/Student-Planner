import { watchPlannerItemsInRange } from '../firebase/planner';
import { shiftDateKey, todayKey } from '../utils/date';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { PlannerItem } from '../types';

export function useUpcoming(classId: string, daysAhead = 14) {
  const start = shiftDateKey(todayKey(), 1);
  const end = shiftDateKey(todayKey(), daysAhead);
  const { data, loading } = useCachedSnapshot<PlannerItem[]>(
    `upcoming:${classId}:${daysAhead}`,
    (cb) => watchPlannerItemsInRange(classId, start, end, cb)
  );
  return { items: data, loading };
}
