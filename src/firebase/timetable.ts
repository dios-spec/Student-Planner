import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import type { Timetable, TimetableDayKey } from '../types';

export const DAY_KEYS: TimetableDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function watchTimetable(classId: string, cb: (t: Timetable | null) => void) {
  return onSnapshot(doc(db, 'timetable', classId), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    cb({ classId, ...snap.data() } as Timetable);
  });
}

export async function saveTimetable(classId: string, days: Timetable['days'], uid: string) {
  await setDoc(
    doc(db, 'timetable', classId),
    { days, updatedBy: uid, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
