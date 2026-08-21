import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { Comment } from '../types';

const commentsCol = collection(db, 'comments');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

export interface NewComment {
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
}

export async function addComment(c: NewComment) {
  await addDoc(commentsCol, stripUndefined({ ...c, createdAt: serverTimestamp() }));
}

/** Live listener for one post's comments, oldest first. */
export function watchComments(postId: string, cb: (comments: Comment[]) => void) {
  const q = query(commentsCol, where('postId', '==', postId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment));
  });
}

/** Author-only delete of a comment. */
export async function deleteComment(id: string) {
  await deleteDoc(doc(commentsCol, id));
}
