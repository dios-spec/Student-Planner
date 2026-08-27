import { watchPostsByUser } from '../firebase/posts';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Post } from '../types';

export function useUserPosts(uid: string | undefined, max = 60) {
  const { data, loading } = useCachedSnapshot<Post[]>(
    // `max` is part of the cache key so growing the window re-subscribes
    // instead of serving the previous, smaller cached page.
    uid ? `userPosts:${uid}:${max}` : 'userPosts:none',
    (cb) => (uid ? watchPostsByUser(uid, cb, max) : () => {})
  );
  return { posts: data, loading };
}
