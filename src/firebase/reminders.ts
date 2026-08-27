import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db } from './config';
import type { Reminder } from '../types';

const remindersCol = collection(db, 'reminders');

export interface NewReminder {
  userId: string;
  itemId: string;
  itemTitle: string;
  remindAt: Date;
}

export async function createReminder(r: NewReminder) {
  await addDoc(remindersCol, {
    userId: r.userId,
    itemId: r.itemId,
    itemTitle: r.itemTitle.slice(0, 200),
    remindAt: Timestamp.fromDate(r.remindAt),
    sent: false,
    createdAt: serverTimestamp(),
  });
}

export function watchMyReminders(uid: string, cb: (list: Reminder[]) => void) {
  const q = query(remindersCol, where('userId', '==', uid));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Reminder)
      .filter((r) => !r.sent)
      .sort((a, b) => (a.remindAt && a.remindAt.toMillis ? a.remindAt.toMillis() : 0) - (b.remindAt && b.remindAt.toMillis ? b.remindAt.toMillis() : 0));
    cb(list);
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[REMINDERS] watchMyReminders failed:', err);
      cb([]);
    }
  );
}

export async function cancelReminder(id: string) {
  await deleteDoc(doc(remindersCol, id));
}
