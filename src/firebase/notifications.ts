import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './config';
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
  data?: Record<string, string>;
}

async function requestServerPush(notificationId: string, senderUid: string) {
  try {
    const user = auth.currentUser;
    if (!user || user.uid !== senderUid) return;
    const idToken = await user.getIdToken();

    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ notificationId }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[PUSH] server rejected delivery', response.status, result);
    }
  } catch (err) {
    // In-app notifications still work even if push delivery is unavailable.
    console.warn('[PUSH] server delivery failed', err);
  }
}

/** Create an in-app notification and request an FCM push for it. */
export async function pushNotification(n: NewNotification, fromUid?: string) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;
  if (senderUid === n.userId) return;

  const ref = await addDoc(
    col,
    stripUndefined({
      ...n,
      fromUid: senderUid,
      read: false,
      createdAt: serverTimestamp(),
    })
  );

  void requestServerPush(ref.id, senderUid);
}

/** Notify several users at once. */
export async function pushToMany(
  userIds: string[],
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const unique = [...new Set(userIds)].filter((u) => u && u !== senderUid);
  await Promise.all(unique.map((userId) => pushNotification({ ...base, userId }, senderUid)));
}

/** Notify all onboarded users in a class except the sender. */
export async function pushToClass(
  classId: string,
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const snap = await getDocs(
    query(collection(db, 'users'), where('classId', '==', classId), limit(200))
  );

  const ids = snap.docs
    .filter((d) => d.id !== senderUid && d.data().onboarded !== false)
    .map((d) => d.id);

  await pushToMany(ids, base, senderUid);
}

/** Notify students only. Legacy profiles without a role are treated as students. */
export async function pushToStudents(
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const snap = await getDocs(query(collection(db, 'users'), limit(300)));
  const ids = snap.docs
    .filter(
      (d) =>
        d.id !== senderUid &&
        d.data().onboarded !== false &&
        d.data().role !== 'teacher'
    )
    .map((d) => d.id);

  await pushToMany(ids, base, senderUid);
}

/** Notify verified teacher profiles only. Authorization still comes from token claims/rules. */
export async function pushToTeachers(
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const snap = await getDocs(query(collection(db, 'users'), limit(300)));
  const ids = snap.docs
    .filter(
      (d) =>
        d.id !== senderUid &&
        d.data().onboarded !== false &&
        d.data().role === 'teacher'
    )
    .map((d) => d.id);

  await pushToMany(ids, base, senderUid);
}

/** Notify every onboarded Student Planner user except the sender. */
export async function pushToAll(
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const snap = await getDocs(query(collection(db, 'users'), limit(300)));
  const ids = snap.docs
    .filter((d) => d.id !== senderUid && d.data().onboarded !== false)
    .map((d) => d.id);

  await pushToMany(ids, base, senderUid);
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
