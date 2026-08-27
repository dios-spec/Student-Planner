import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import type { Timetable, TimetableDayKey } from '../types';

export const DAY_KEYS: TimetableDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function watchTimetable(classId: string, cb: (t: Timetable | null) => void) {
  return onSnapshot(doc(db, 'timetable', classId), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    cb({ classId, ...snap.data() } as Timetable);
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[TIMETABLE] watchTimetable failed:', err);
      cb(null);
    }
  );
}

export async function saveTimetable(classId: string, days: Timetable['days'], uid: string) {
  await setDoc(
    doc(db, 'timetable', classId),
    { days, updatedBy: uid, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
