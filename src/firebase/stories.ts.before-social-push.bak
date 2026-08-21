import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { Story } from '../types';

const storiesCol = collection(db, 'stories');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

export interface NewStory {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  imageUrl: string;
  mediaType?: 'image' | 'video';
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createStory(story: NewStory) {
  await addDoc(storiesCol, stripUndefined({
    ...story,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + DAY_MS),
    seenBy: [],
  }));
}

/** Live listener for all stories that haven't expired yet, newest first. */
export function watchActiveStories(cb: (stories: Story[]) => void) {
  const now = Timestamp.fromMillis(Date.now());
  const q = query(storiesCol, where('expiresAt', '>', now), orderBy('expiresAt', 'asc'));
  return onSnapshot(q, (snap) => {
    const stories = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Story)
      .sort((a, b) => {
        const at = a.createdAt?.toMillis?.() ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? 0;
        return bt - at;
      });
    cb(stories);
  });
}

export async function markStorySeen(storyId: string, uid: string) {
  await updateDoc(doc(storiesCol, storyId), { seenBy: arrayUnion(uid) }).catch(() => {});
}

export async function deleteStory(storyId: string) {
  await deleteDoc(doc(storiesCol, storyId));
}
