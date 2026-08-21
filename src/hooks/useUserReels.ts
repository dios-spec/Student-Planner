import { watchReelsByUser } from '../firebase/reels';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Reel } from '../types';

export function useUserReels(uid: string | undefined) {
  const { data, loading } = useCachedSnapshot<Reel[]>(
    uid ? `userReels:${uid}` : 'userReels:none',
    (cb) => (uid ? watchReelsByUser(uid, cb) : () => {})
  );
  return { reels: data, loading };
}
