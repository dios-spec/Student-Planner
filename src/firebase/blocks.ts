import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { BlockEntry } from '../types';

const blocksCol = collection(db, 'blocks');

function blockDocId(blocker: string, blocked: string) {
  return `${blocker}_${blocked}`;
}

export async function blockUser(blockerId: string, blockedId: string) {
  await setDoc(doc(blocksCol, blockDocId(blockerId, blockedId)), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await deleteDoc(doc(blocksCol, blockDocId(blockerId, blockedId)));
}

/** Live set of users I've blocked. */
export function watchMyBlocks(uid: string, cb: (blockedIds: Set<string>) => void) {
  const q = query(blocksCol, where('blockerId', '==', uid));
  return onSnapshot(q, (snap) => {
    cb(new Set(snap.docs.map((d) => (d.data() as BlockEntry).blockedId)));
  });
}

/** Live set of users who have blocked ME (so I can't message them). */
export function watchBlockedByOthers(uid: string, cb: (blockerIds: Set<string>) => void) {
  const q = query(blocksCol, where('blockedId', '==', uid));
  return onSnapshot(q, (snap) => {
    cb(new Set(snap.docs.map((d) => (d.data() as BlockEntry).blockerId)));
  });
}
