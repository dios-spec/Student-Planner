import { useEffect, useState } from 'react';
import { watchAnnouncements } from '../firebase/announcements';
import type { Announcement } from '../types';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  useEffect(() => watchAnnouncements(setAnnouncements), []);

  return { announcements, loading: announcements === null };
}
