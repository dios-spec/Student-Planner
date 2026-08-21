import { watchAnnouncements } from '../firebase/announcements';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Announcement } from '../types';

export function useAnnouncements(classId: string) {
  const { data, loading } = useCachedSnapshot<Announcement[]>(
    `announcements:${classId}`,
    (cb) => watchAnnouncements(classId, cb)
  );
  return { announcements: data, loading };
}
