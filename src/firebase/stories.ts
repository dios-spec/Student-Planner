import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { Story } from '../types';
import { pushToAll, pushNotification } from './notifications';

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
  const ref = await addDoc(storiesCol, stripUndefined({
    ...story,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + DAY_MS),
    seenBy: [],
  }));

  void pushToAll(
    {
      type: 'storyNew',
      title: `${story.authorName} added a story`,
      body: story.mediaType === 'video' ? 'New video story' : 'New story',
      icon: story.authorAvatar || story.imageUrl,
      route: '/',
      data: { storyId: ref.id },
    },
    story.authorId
  ).catch(() => {});
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

export async function toggleStoryLike(storyId: string, uid: string, liked: boolean) {
  const ref = doc(storiesCol, storyId);
  const before = await getDoc(ref).catch(() => null);

  await updateDoc(ref, { likes: liked ? arrayRemove(uid) : arrayUnion(uid) });

  if (!liked && before?.exists()) {
    const story = before.data() as Story;
    if (story.authorId && story.authorId !== uid) {
      void pushNotification(
        {
          userId: story.authorId,
          type: 'storyLike',
          title: 'Someone liked your story',
          body: 'Your story got a new like',
          icon: story.imageUrl,
          route: '/',
          data: { storyId },
        },
        uid
      ).catch(() => {});
    }
  }
}

export async function getStoryOnce(storyId: string): Promise<Story | null> {
  const snap = await getDoc(doc(storiesCol, storyId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Story) : null;
}
