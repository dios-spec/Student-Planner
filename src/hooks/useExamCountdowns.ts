import { watchPlannerItemsInRange } from '../firebase/planner';
import { shiftDateKey, todayKey } from '../utils/date';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { PlannerItem } from '../types';

export function useExamCountdowns(classId: string, daysAhead = 120) {
  const start = todayKey();
  const end = shiftDateKey(start, daysAhead);
  const { data, loading } = useCachedSnapshot<PlannerItem[]>(
    `examCountdowns:${classId}:${daysAhead}:${start}`,
    (cb) => watchPlannerItemsInRange(classId, start, end, (items) => {
      cb(
        items
          .filter((item) => item.category === 'test')
          .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date))
      );
    })
  );
  return { exams: data || [], loading };
}
