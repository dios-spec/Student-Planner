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
  limit,
} from 'firebase/firestore';
import { db } from './config';
import type { Post } from '../types';
import { pushNotification } from './notifications';

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
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[POSTS] watchFeed failed:', err);
      cb([]);
    }
  );
}

/** All posts by one author (used on their profile). */
/** Author's posts, newest first.
 *  Previously unbounded: a prolific author streamed their entire history to
 *  every visitor of their profile, and the listener kept growing all year.
 *  `max` is a GROWABLE window -- ProfilePage raises it on "Show more", so
 *  nothing is unreachable, unlike a hard cap. */
export function watchPostsByUser(uid: string, cb: (posts: Post[]) => void, max = 60) {
  const q = query(postsCol, where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post));
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[POSTS] watchPostsByUser failed:', err);
      cb([]);
    }
  );
}

export async function toggleLike(postId: string, uid: string, liked: boolean) {
  const ref = doc(postsCol, postId);
  const before = await getDoc(ref).catch(() => null);

  await updateDoc(ref, {
    likes: liked ? arrayRemove(uid) : arrayUnion(uid),
  });

  // Only notify for a new like, never for unlike and never notify yourself.
  if (!liked && before?.exists()) {
    const post = before.data() as Post;
    if (post.authorId && post.authorId !== uid) {
      void pushNotification(
        {
          userId: post.authorId,
          type: 'postLike',
          title: 'Someone liked your post',
          body: post.caption || 'Your post got a new like',
          icon: post.imageUrl,
          route: '/',
          data: { postId },
        },
        uid
      ).catch(() => {});
    }
  }
}

/** Author-only delete. */
export async function deletePost(postId: string) {
  await deleteDoc(doc(postsCol, postId));
}
