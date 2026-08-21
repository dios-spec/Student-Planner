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
  arrayRemove,
  limit,
} from 'firebase/firestore';
import { db } from './config';
import type { Post } from '../types';

const postsCol = collection(db, 'posts');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

export interface NewPost {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  imageUrl: string;
  caption?: string;
}

export async function createPost(post: NewPost) {
  await addDoc(postsCol, stripUndefined({
    ...post,
    likes: [],
    createdAt: serverTimestamp(),
  }));
}

/** Live feed of all posts, newest first. */
export function watchFeed(cb: (posts: Post[]) => void) {
  const q = query(postsCol, orderBy('createdAt', 'desc'), limit(60));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post));
  });
}

/** All posts by one author (used on their profile). */
export function watchPostsByUser(uid: string, cb: (posts: Post[]) => void) {
  const q = query(postsCol, where('authorId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post));
  });
}

export async function toggleLike(postId: string, uid: string, liked: boolean) {
  await updateDoc(doc(postsCol, postId), {
    likes: liked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

/** Author-only delete. */
export async function deletePost(postId: string) {
  await deleteDoc(doc(postsCol, postId));
}
