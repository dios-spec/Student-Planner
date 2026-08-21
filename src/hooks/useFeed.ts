import { watchFeed } from '../firebase/posts';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Post } from '../types';

export function useFeed() {
  const { data, loading } = useCachedSnapshot<Post[]>('feed', watchFeed);
  return { posts: data, loading };
}
