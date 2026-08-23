import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from './config';
import type { PlannerItem, CompletionRecord } from '../types';
import { pushToClass } from './notifications';

const itemsCol = collection(db, 'plannerItems');
const completionCol = collection(db, 'completionStatus');

/** Firestore rejects `undefined` field values — strip them before writing. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

export type NewPlannerItem = Pick<
  PlannerItem,
  'classId' | 'date' | 'subject' | 'category' | 'title'
> &
  Partial<Pick<PlannerItem, 'description' | 'dueDate' | 'portion' | 'note' | 'attachments'>>;

export async function addPlannerItem(
  item: NewPlannerItem,
  userId: string,
  userName: string
) {
  await addDoc(itemsCol, stripUndefined({
    ...item,
    createdBy: userId,
    createdByName: userName,
    createdAt: serverTimestamp(),
    deleted: false,
  }));

  void pushToClass(
    item.classId,
    {
      type: item.category === 'test' ? 'exam' : 'homework',
      title:
        item.category === 'test' ? 'New test/exam' :
        item.category === 'project' ? 'New project' :
        item.category === 'important' ? 'Important class update' :
        'New class work',
      body: `${userName}: ${item.title}`,
      route: '/planner',
      data: { classId: item.classId, date: item.date },
    },
    userId
  ).catch(() => {});
}

export async function updatePlannerItem(
  id: string,
  patch: Partial<PlannerItem>,
  userId: string,
  userName: string
) {
  const before = await getDoc(doc(itemsCol, id)).catch(() => null);
  const oldItem = before?.exists() ? (before.data() as PlannerItem) : null;

  await updateDoc(doc(itemsCol, id), stripUndefined({
    ...patch,
    updatedBy: userId,
    updatedByName: userName,
    updatedAt: serverTimestamp(),
  }));

  const classId = patch.classId || oldItem?.classId;
  const title = patch.title || oldItem?.title;
  const date = patch.date || oldItem?.date;

  if (classId && title) {
    void pushToClass(
      classId,
      {
        type: patch.category === 'test' || oldItem?.category === 'test' ? 'exam' : 'homework',
        title: 'Planner updated',
        body: `${userName}: ${title}`,
        route: '/planner',
        data: { classId, ...(date ? { date } : {}) },
      },
      userId
    ).catch(() => {});
  }
}

/** Soft delete — item is hidden immediately but recoverable via undo. */
export async function softDeletePlannerItem(id: string, userId: string, userName: string) {
  await updateDoc(doc(itemsCol, id), {
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedBy: userId,
    updatedByName: userName,
  });
}

export async function restorePlannerItem(id: string, userId: string, userName: string) {
  await updateDoc(doc(itemsCol, id), {
    deleted: false,
    updatedBy: userId,
    updatedByName: userName,
  });
}

/** Live listener for every non-deleted planner item on a given day. */
export function watchPlannerItemsForDate(
  classId: string,
  dateKey: string,
  cb: (items: PlannerItem[]) => void
) {
  const q = query(
    itemsCol,
    where('classId', '==', classId),
    where('date', '==', dateKey),
    where('deleted', '==', false)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlannerItem));
  });
}

/** Live listener for a date range. Tests/projects are placed by due date when present. */
export function watchPlannerItemsInRange(
  classId: string,
  startKey: string,
  endKey: string,
  cb: (items: PlannerItem[]) => void
) {
  const q = query(
    itemsCol,
    where('classId', '==', classId),
    where('deleted', '==', false),
    orderBy('date', 'asc'),
    limit(500)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PlannerItem)
      .filter((item) => {
        const effectiveDate = item.dueDate || item.date;
        return effectiveDate >= startKey && effectiveDate <= endKey;
      })
      .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
    cb(items);
  });
}

/** Per-user completion is its own tiny doc so "done" never overwrites the shared task. */
export function watchMyCompletions(userId: string, cb: (map: Record<string, boolean>) => void) {
  const q = query(completionCol, where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const map: Record<string, boolean> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as CompletionRecord;
      map[data.itemId] = data.done;
    });
    cb(map);
  });
}

/** One-off fetch used by the search overlay (small class-sized dataset, so a client-side filter is fine). */
export async function getAllActiveItemsOnce(classId: string): Promise<PlannerItem[]> {
  const q = query(itemsCol, where('classId', '==', classId), where('deleted', '==', false), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlannerItem);
}

export async function setCompletion(userId: string, itemId: string, done: boolean) {
  // Deterministic doc id (userId_itemId) means this always upserts the same doc
  // instead of creating duplicates every time a student toggles a checkbox.
  const id = `${userId}_${itemId}`;
  await setDoc(
    doc(completionCol, id),
    { userId, itemId, done, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Personal "pin for me" marker -- merges onto the same per-user completion
 * doc without touching `done`, so it never changes the shared task. */
export async function setImportantForMe(userId: string, itemId: string, important: boolean) {
  const id = `${userId}_${itemId}`;
  await setDoc(
    doc(completionCol, id),
    { userId, itemId, important, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
