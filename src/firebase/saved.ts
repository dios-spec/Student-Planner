import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from './config';
import type { SavedItem, SavedItemType } from '../types';

const savedCol = collection(db, 'saved');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

function savedId(uid: string, type: SavedItemType, refId: string): string {
  return uid + '_' + type + '_' + refId;
}

export interface NewSavedItem {
  userId: string;
  type: SavedItemType;
  refId: string;
  conversationId?: string;
  title: string;
  imageUrl?: string;
  authorName?: string;
}

export async function saveItem(item: NewSavedItem) {
  const id = savedId(item.userId, item.type, item.refId);
  await setDoc(doc(savedCol, id), stripUndefined({ ...item, createdAt: serverTimestamp() }));
}

export async function unsaveItem(userId: string, type: SavedItemType, refId: string) {
  await deleteDoc(doc(savedCol, savedId(userId, type, refId)));
}

export function watchMySaved(uid: string, cb: (items: SavedItem[]) => void) {
  const q = query(savedCol, where('userId', '==', uid));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SavedItem)
      .sort((a, b) => ((b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : 0) - ((a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : 0));
    cb(list);
  });
}
