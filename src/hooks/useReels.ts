import { watchReels } from '../firebase/reels';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Reel } from '../types';

export function useReels() {
  const { data, loading } = useCachedSnapshot<Reel[]>('reels', watchReels);
  return { reels: data, loading };
}
