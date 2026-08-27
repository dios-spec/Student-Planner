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
  Timestamp,
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

/** Notifications per /api/send-push request. Must not exceed the server's cap. */
const PUSH_BATCH = 50;

/**
 * Ask the server to deliver push for these notifications.
 *
 * This used to be one HTTP request per recipient, each doing its own
 * transaction plus a user read plus a device read. A single class message to
 * 300 students therefore meant 300 serverless invocations and ~900 Firestore
 * reads. The endpoint now accepts a batch, dedupes recipient reads inside it,
 * and hands FCM one batched send.
 */
async function requestServerPush(notificationIds: string[], senderUid: string) {
  if (!notificationIds.length) return;

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
      body: JSON.stringify({ notificationIds }),
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

// BUG-09: every class-chat message re-read up to 300 user docs just to build
// the recipient list. The roster barely changes, so cache it briefly. This is
// the single biggest Firestore read reduction available without a data model
// change (300 reads per message -> 300 reads per ROSTER_TTL_MS).
const ROSTER_TTL_MS = 120_000;
const rosterCache = new Map<string, { ids: string[]; at: number }>();

async function cachedRoster(
  cacheKey: string,
  load: () => Promise<string[]>
): Promise<string[]> {
  const hit = rosterCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ROSTER_TTL_MS) return hit.ids;
  const ids = await load();
  rosterCache.set(cacheKey, { ids, at: Date.now() });
  return ids;
}

/** Call after a roster-changing event (onboarding, class switch, role change). */
export function invalidateRosterCache() {
  rosterCache.clear();
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

  void requestServerPush([ref.id], senderUid);
}

/** Notify several users at once.
 *  BUG-09: previously this issued one addDoc AND one /api/send-push fetch per
 *  recipient, serially awaited. For a 100-student class that was 100 separate
 *  round trips before the sender's message even settled. Now the Firestore
 *  writes go out as chunked batches (1 round trip per 450 recipients) and the
 *  push requests are fired with bounded concurrency in the background. */
export async function pushToMany(
  userIds: string[],
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const unique = [...new Set(userIds)].filter((u) => u && u !== senderUid);
  if (!unique.length) return;

  const ids: string[] = [];
  const CHUNK = 450; // Firestore hard-caps writeBatch at 500 ops

  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const userId of unique.slice(i, i + CHUNK)) {
      const ref = doc(col);
      batch.set(
        ref,
        stripUndefined({
          ...base,
          userId,
          fromUid: senderUid,
          read: false,
          createdAt: serverTimestamp(),
        })
      );
      ids.push(ref.id);
    }
    // A batch is atomic -- guard so one rejected chunk cannot silence the rest.
    try {
      await batch.commit();
    } catch (err) {
      console.error('[NOTIF] batch commit failed for a chunk:', err);
    }
  }

  // One request per PUSH_BATCH recipients, in the background. Previously this
  // opened one connection per recipient with a concurrency pool of 6.
  void (async () => {
    for (let i = 0; i < ids.length; i += PUSH_BATCH) {
      await requestServerPush(ids.slice(i, i + PUSH_BATCH), senderUid);
    }
  })();
}

/** Notify all onboarded users in a class except the sender. */
export async function pushToClass(
  classId: string,
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const all = await cachedRoster(`class:${classId}`, async () => {
    const snap = await getDocs(
      query(collection(db, 'users'), where('classId', '==', classId), limit(200))
    );
    return snap.docs.filter((d) => d.data().onboarded !== false).map((d) => d.id);
  });

  await pushToMany(all.filter((id) => id !== senderUid), base, senderUid);
}

/** Notify students only. Legacy profiles without a role are treated as students. */
export async function pushToStudents(
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const all = await cachedRoster('students', async () => {
    const snap = await getDocs(query(collection(db, 'users'), limit(300)));
    return snap.docs
      .filter((d) => d.data().onboarded !== false && d.data().role !== 'teacher')
      .map((d) => d.id);
  });

  await pushToMany(all.filter((id) => id !== senderUid), base, senderUid);
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

/** BUG-11: notifications had no TTL and were never pruned, so every user's
 *  collection grew without bound forever. Opportunistically delete READ
 *  notifications older than the retention window, once per session, in the
 *  background. Unread items are never touched. */
const RETENTION_DAYS = 30;
let prunedThisSession = false;

export async function pruneOldNotifications(uid: string) {
  if (prunedThisSession) return;
  prunedThisSession = true;
  try {
    const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 86_400_000);
    const snap = await getDocs(
      query(
        col,
        where('userId', '==', uid),
        where('read', '==', true),
        where('createdAt', '<', cutoff),
        limit(400)
      )
    );
    if (snap.empty) return;
    const CHUNK = 450;
    for (let i = 0; i < snap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    // Most likely a missing composite index -- non-fatal, just skip pruning.
    console.warn('[NOTIF] prune skipped:', err);
  }
}

/**
 * Types that exist only to drive the service worker (for example telling it to
 * take a dead ringing-call notification off the lock screen). They are real
 * documents because /api/send-push delivers from a document, but they are not
 * things a person should ever see in their notification list, and they must not
 * count towards the unread badge.
 */
const CONTROL_TYPES = new Set(['callEnded']);

export function isControlNotification(type: string): boolean {
  return CONTROL_TYPES.has(type);
}

export function watchNotifications(uid: string, cb: (items: AppNotification[]) => void) {
  const q = query(col, where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification);

      // Control documents have done their job by the time they arrive here
      // (the push has already been dispatched from them). Delete them as they
      // are seen -- free, and it needs no extra query or composite index.
      all
        .filter((n) => isControlNotification(n.type))
        .forEach((n) => void deleteDoc(doc(col, n.id)).catch(() => {}));

      cb(all.filter((n) => !isControlNotification(n.type)));
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[NOTIF] watchNotifications failed:', err);
      cb([]);
    }
  );
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(col, id), { read: true }).catch(() => {});
}

export async function markAllRead(uid: string) {
  // BUG-16: Firestore hard-caps writeBatch at 500 ops. With notification
  // fan-out, 500+ unread is realistic, and the whole commit would reject.
  const snap = await getDocs(query(col, where('userId', '==', uid), where('read', '==', false)));
  const CHUNK = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  }
}

export async function clearNotification(id: string) {
  await deleteDoc(doc(col, id));
}
