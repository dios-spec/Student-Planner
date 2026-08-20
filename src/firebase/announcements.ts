import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, limit } from 'firebase/firestore';
import { db } from './config';
import type { Announcement } from '../types';

const col = collection(db, 'announcements');

export async function addAnnouncement(
  title: string,
  body: string,
  forDate: string | undefined,
  userId: string,
  userName: string
) {
  await addDoc(col, {
    title,
    body,
    forDate: forDate ?? null,
    createdBy: userId,
    createdByName: userName,
    createdAt: serverTimestamp(),
  });
}

export function watchAnnouncements(cb: (items: Announcement[]) => void) {
  const q = query(col, orderBy('createdAt', 'desc'), limit(20));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement));
  });
}
