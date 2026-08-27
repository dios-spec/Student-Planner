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

  // BUG-12: only notify when something students actually care about moved.
  // Previously every edit (including fixing a typo) pushed to the whole class.
  const materialChange =
    (patch.title !== undefined && patch.title !== oldItem?.title) ||
    (patch.dueDate !== undefined && patch.dueDate !== oldItem?.dueDate) ||
    (patch.date !== undefined && patch.date !== oldItem?.date) ||
    (patch.category !== undefined && patch.category !== oldItem?.category) ||
    (patch.classId !== undefined && patch.classId !== oldItem?.classId);

  if (classId && title && materialChange) {
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
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[PLANNER] watchPlannerItems failed:', err);
      cb([]);
    }
  );
}

/**
 * Live listener for a date range. Tests/projects are placed by due date when present.
 *
 * History: this query originally had NO date bounds at all -- `orderBy(date asc)
 * limit(500)` returns the OLDEST 500 items, so once a class passed 500 planner
 * items the window no longer contained today and Upcoming, exam countdowns and
 * the dashboard all went silently empty. Phase 1 bounded it with a 180-day
 * lookback, which fixed that but was a heuristic: an item created more than 180
 * days before its due date still vanished.
 *
 * It is now exact, with no lookback constant. Two bounded listeners are merged:
 *   A. items whose `date` falls in the range  -- covers items with no dueDate
 *   B. items whose `dueDate` falls in the range -- covers everything else
 * The existing effectiveDate filter then decides membership, so an item that
 * matches A but whose dueDate moved it out of the window is still excluded.
 *
 * Requires the composite index (classId, deleted, dueDate) -- added to
 * firestore.indexes.json alongside the existing (classId, deleted, date).
 */
export function watchPlannerItemsInRange(
  classId: string,
  startKey: string,
  endKey: string,
  cb: (items: PlannerItem[]) => void
) {
  const base = [where('classId', '==', classId), where('deleted', '==', false)] as const;

  const byDate = query(
    itemsCol,
    ...base,
    where('date', '>=', startKey),
    where('date', '<=', endKey),
    orderBy('date', 'asc'),
    limit(500)
  );

  const byDueDate = query(
    itemsCol,
    ...base,
    where('dueDate', '>=', startKey),
    where('dueDate', '<=', endKey),
    orderBy('dueDate', 'asc'),
    limit(500)
  );

  let fromDate: PlannerItem[] | null = null;
  let fromDueDate: PlannerItem[] | null = null;

  const emit = () => {
    // Wait for both listeners before the first emission, otherwise the UI
    // flickers through a half-populated list.
    if (fromDate === null || fromDueDate === null) return;

    const byId = new Map<string, PlannerItem>();
    for (const item of [...fromDate, ...fromDueDate]) byId.set(item.id, item);

    cb(
      [...byId.values()]
        .filter((item) => {
          const effectiveDate = item.dueDate || item.date;
          return effectiveDate >= startKey && effectiveDate <= endKey;
        })
        .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date))
    );
  };

  const toItems = (snap: { docs: { id: string; data: () => unknown }[] }) =>
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as PlannerItem);

  const unsubA = onSnapshot(
    byDate,
    (snap) => { fromDate = toItems(snap); emit(); },
    (err) => {
      console.error('[PLANNER] watchPlannerItemsInRange (date) failed:', err);
      fromDate = []; emit();
    }
  );

  const unsubB = onSnapshot(
    byDueDate,
    (snap) => { fromDueDate = toItems(snap); emit(); },
    (err) => {
      // A missing composite index shows up here. Degrade to the date-only
      // result rather than emptying the planner.
      console.error('[PLANNER] watchPlannerItemsInRange (dueDate) failed:', err);
      fromDueDate = []; emit();
    }
  );

  return () => { unsubA(); unsubB(); };
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
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[PLANNER] watchMyCompletions failed:', err);
      cb({});
    }
  );
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
