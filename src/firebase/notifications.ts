import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from './config';
import type { AppNotification, NotifType } from '../types';

const col = collection(db, 'notifications');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

export interface NewNotification {
  userId: string;
  type: NotifType;
  title: string;
  body?: string;
  icon?: string;
  route?: string;
}

/** Create a notification for a user. Never notify yourself. */
export async function pushNotification(n: NewNotification, fromUid?: string) {
  if (fromUid && fromUid === n.userId) return;
  await addDoc(col, stripUndefined({ ...n, read: false, createdAt: serverTimestamp() }));
}

/** Notify several users at once (e.g. a group message). */
export async function pushToMany(userIds: string[], base: Omit<NewNotification, 'userId'>, fromUid?: string) {
  await Promise.all(
    userIds.filter((u) => u !== fromUid).map((userId) => pushNotification({ ...base, userId }))
  );
}

export function watchNotifications(uid: string, cb: (items: AppNotification[]) => void) {
  const q = query(col, where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification));
  });
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(col, id), { read: true }).catch(() => {});
}

export async function markAllRead(uid: string) {
  const snap = await getDocs(query(col, where('userId', '==', uid), where('read', '==', false)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function clearNotification(id: string) {
  await deleteDoc(doc(col, id));
}
