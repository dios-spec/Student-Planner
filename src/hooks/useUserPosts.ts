import { watchPostsByUser } from '../firebase/posts';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Post } from '../types';

export function useUserPosts(uid: string | undefined) {
  const { data, loading } = useCachedSnapshot<Post[]>(
    uid ? `userPosts:${uid}` : 'userPosts:none',
    (cb) => (uid ? watchPostsByUser(uid, cb) : () => {})
  );
  return { posts: data, loading };
}
