import { useEffect, useState } from 'react';
import { watchTimetable } from '../firebase/timetable';
import type { Timetable } from '../types';

export function useTimetable(classId: string) {
  const [timetable, setTimetable] = useState<Timetable | null | undefined>(undefined);
  useEffect(() => {
    setTimetable(undefined);
    return watchTimetable(classId, setTimetable);
  }, [classId]);
  return { timetable, loading: timetable === undefined };
}
