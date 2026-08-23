import { useEffect, useMemo, useState } from 'react';
import {
  calculateMeritStats,
  earnedMeritBadges,
  watchAllMeritRecords,
  watchMeritProfiles,
  watchMeritRecords,
} from '../firebase/merits';
import type { MeritRecord, StudentProfile } from '../types';

export function useMeritRecords(uid: string | undefined | null) {
  const [records, setRecords] = useState<MeritRecord[] | null>(null);

  useEffect(() => {
    if (!uid) {
      setRecords([]);
      return;
    }
    setRecords(null);
    return watchMeritRecords(uid, setRecords);
  }, [uid]);

  const safeRecords = records || [];
  const stats = useMemo(() => calculateMeritStats(safeRecords), [safeRecords]);
  const badges = useMemo(() => earnedMeritBadges(safeRecords), [safeRecords]);

  return {
    records: safeRecords,
    stats,
    badges,
    loading: records === null,
  };
}

export function useMeritRoster() {
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [records, setRecords] = useState<MeritRecord[]>([]);

  useEffect(() => {
    const unsubProfiles = watchMeritProfiles(setProfiles);
    const unsubRecords = watchAllMeritRecords(setRecords);
    return () => {
      unsubProfiles();
      unsubRecords();
    };
  }, []);

  return { profiles, records };
}
