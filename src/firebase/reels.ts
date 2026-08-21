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
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './config';
import type { Reel } from '../types';

const reelsCol = collection(db, 'reels');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

export interface NewReel {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  videoUrl: string;
  thumbUrl?: string;
  caption?: string;
}

export async function createReel(r: NewReel) {
  await addDoc(reelsCol, stripUndefined({ ...r, likes: [], createdAt: serverTimestamp() }));
}

export function watchReels(cb: (reels: Reel[]) => void) {
  const q = query(reelsCol, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reel));
  });
}

export function watchReelsByUser(uid: string, cb: (reels: Reel[]) => void) {
  const q = query(reelsCol, where('authorId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reel));
  });
}

export async function toggleReelLike(reelId: string, uid: string, liked: boolean) {
  await updateDoc(doc(reelsCol, reelId), { likes: liked ? arrayRemove(uid) : arrayUnion(uid) });
}

export async function deleteReel(reelId: string) {
  await deleteDoc(doc(reelsCol, reelId));
}
