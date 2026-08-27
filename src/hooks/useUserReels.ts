import { watchReelsByUser } from '../firebase/reels';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Reel } from '../types';

export function useUserReels(uid: string | undefined, max = 50) {
  const { data, loading } = useCachedSnapshot<Reel[]>(
    uid ? `userReels:${uid}:${max}` : 'userReels:none',
    (cb) => (uid ? watchReelsByUser(uid, cb, max) : () => {})
  );
  return { reels: data, loading };
}
