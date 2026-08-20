import {
  addDoc,
  collection,
  doc,
  getDocs,
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

const itemsCol = collection(db, 'plannerItems');
const completionCol = collection(db, 'completionStatus');

export type NewPlannerItem = Pick<
  PlannerItem,
  'date' | 'subject' | 'category' | 'title'
> &
  Partial<Pick<PlannerItem, 'description' | 'dueDate' | 'portion' | 'note'>>;

export async function addPlannerItem(
  item: NewPlannerItem,
  userId: string,
  userName: string
) {
  await addDoc(itemsCol, {
    ...item,
    createdBy: userId,
    createdByName: userName,
    createdAt: serverTimestamp(),
    deleted: false,
  });
}

export async function updatePlannerItem(
  id: string,
  patch: Partial<PlannerItem>,
  userId: string,
  userName: string
) {
  await updateDoc(doc(itemsCol, id), {
    ...patch,
    updatedBy: userId,
    updatedByName: userName,
    updatedAt: serverTimestamp(),
  });
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
export function watchPlannerItemsForDate(dateKey: string, cb: (items: PlannerItem[]) => void) {
  const q = query(itemsCol, where('date', '==', dateKey), where('deleted', '==', false));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlannerItem));
  });
}

/** Live listener for a date range, used by the Upcoming tab. */
export function watchPlannerItemsInRange(
  startKey: string,
  endKey: string,
  cb: (items: PlannerItem[]) => void
) {
  const q = query(
    itemsCol,
    where('date', '>=', startKey),
    where('date', '<=', endKey),
    where('deleted', '==', false),
    orderBy('date', 'asc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlannerItem));
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
export async function getAllActiveItemsOnce(): Promise<PlannerItem[]> {
  const q = query(itemsCol, where('deleted', '==', false));
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
