import { useEffect, useState } from 'react';
import { watchPlannerItemsInRange } from '../firebase/planner';
import { shiftDateKey, todayKey } from '../utils/date';
import type { PlannerItem } from '../types';

/** Everything scheduled between tomorrow and N days out, grouped for the Upcoming tab. */
export function useUpcoming(daysAhead = 14) {
  const [items, setItems] = useState<PlannerItem[] | null>(null);

  useEffect(() => {
    const start = shiftDateKey(todayKey(), 1);
    const end = shiftDateKey(todayKey(), daysAhead);
    const unsub = watchPlannerItemsInRange(start, end, setItems);
    return unsub;
  }, [daysAhead]);

  return { items, loading: items === null };
}
