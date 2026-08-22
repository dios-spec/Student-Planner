import { useEffect, useState } from 'react';
import {
  watchPlannerItemsForDate,
  watchPlannerItemsInRange,
  watchMyCompletions,
} from '../firebase/planner';
import { todayKey, shiftDateKey } from '../utils/date';
import type { PlannerItem } from '../types';

/** Home-dashboard data: today's task progress + next few tests/projects. */
export function useHomeDashboard(classId: string, userId: string | undefined) {
  const [today, setToday] = useState<PlannerItem[] | null>(null);
  const [upcoming, setUpcoming] = useState<PlannerItem[] | null>(null);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!classId) return;
    return watchPlannerItemsForDate(classId, todayKey(), setToday);
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    const end = shiftDateKey(todayKey(), 14);
    return watchPlannerItemsInRange(classId, todayKey(), end, setUpcoming);
  }, [classId]);

  useEffect(() => {
    if (!userId) { setCompletions({}); return; }
    return watchMyCompletions(userId, setCompletions);
  }, [userId]);

  const upcomingTests = (upcoming || [])
    .filter((i) => i.category === 'test' || i.category === 'project')
    .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date))
    .slice(0, 3);

  const totalToday = today?.length ?? 0;
  const doneToday = (today || []).filter((i) => completions[i.id]).length;

  return { upcomingTests, doneToday, totalToday, loading: today === null };
}
