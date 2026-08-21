import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, limit, where } from 'firebase/firestore';
import { db } from './config';
import type { Announcement } from '../types';
import { pushToClass } from './notifications';

const col = collection(db, 'announcements');

export async function addAnnouncement(
  classId: string,
  title: string,
  body: string,
  forDate: string | undefined,
  userId: string,
  userName: string
) {
  await addDoc(col, {
    classId,
    title,
    body,
    forDate: forDate ?? null,
    createdBy: userId,
    createdByName: userName,
    createdAt: serverTimestamp(),
  });

  void pushToClass(
    classId,
    {
      type: 'announcement',
      title,
      body,
      route: '/planner',
      data: { classId, ...(forDate ? { forDate } : {}) },
    },
    userId
  ).catch(() => {});
}

export function watchAnnouncements(classId: string, cb: (items: Announcement[]) => void) {
  const q = query(col, where('classId', '==', classId), orderBy('createdAt', 'desc'), limit(20));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement));
  });
}

/** Author-only delete. */
export async function deleteAnnouncement(id: string) {
  await deleteDoc(doc(col, id));
}
