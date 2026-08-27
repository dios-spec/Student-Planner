import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import { pushNotification } from './notifications';

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
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[REELS] watchReels failed:', err);
      cb([]);
    }
  );
}

/** Author's reels, newest first. Growable window -- see watchPostsByUser. */
export function watchReelsByUser(uid: string, cb: (reels: Reel[]) => void, max = 50) {
  const q = query(reelsCol, where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reel));
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[REELS] watchReelsByUser failed:', err);
      cb([]);
    }
  );
}

export async function toggleReelLike(reelId: string, uid: string, liked: boolean) {
  const ref = doc(reelsCol, reelId);
  const before = await getDoc(ref).catch(() => null);

  await updateDoc(ref, { likes: liked ? arrayRemove(uid) : arrayUnion(uid) });

  if (!liked && before?.exists()) {
    const reel = before.data() as Reel;
    if (reel.authorId && reel.authorId !== uid) {
      void pushNotification(
        {
          userId: reel.authorId,
          type: 'reelLike',
          title: 'Someone liked your reel',
          body: reel.caption || 'Your reel got a new like',
          icon: reel.thumbUrl,
          route: '/reels',
          data: { reelId },
        },
        uid
      ).catch(() => {});
    }
  }
}

export async function deleteReel(reelId: string) {
  await deleteDoc(doc(reelsCol, reelId));
}
