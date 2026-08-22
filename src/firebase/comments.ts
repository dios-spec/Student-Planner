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
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { Comment } from '../types';
import { pushNotification } from './notifications';

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

  // postId may point at either a post or (reused from StoryViewer) a story --
  // check both so the right owner gets notified either way.
  const postSnap = await getDoc(doc(db, 'posts', c.postId)).catch(() => null);
  const storySnap = postSnap?.exists() ? null : await getDoc(doc(db, 'stories', c.postId)).catch(() => null);
  const owner = postSnap?.exists()
    ? (postSnap.data() as { authorId?: string }).authorId
    : storySnap?.exists()
    ? (storySnap.data() as { authorId?: string }).authorId
    : undefined;

  if (owner && owner !== c.authorId) {
    void pushNotification(
      {
        userId: owner,
        type: 'comment',
        title: `${c.authorName} commented`,
        body: c.text,
        icon: c.authorAvatar,
        route: '/',
        data: { postId: c.postId },
      },
      c.authorId
    ).catch(() => {});
  }
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
