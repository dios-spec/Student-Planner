import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  calculateMeritStats,
  earnedMeritBadges,
  watchAllMeritRecords,
  watchMeritProfiles,
  type MeritBadge,
  type MeritStats,
} from '../firebase/merits';
import type { MeritRecord, StudentProfile } from '../types';

const EMPTY_STATS: MeritStats = {
  merit: 0,
  demerit: 0,
  net: 0,
  meritAwards: 0,
  demeritAwards: 0,
};

interface MeritUserData {
  records: MeritRecord[];
  stats: MeritStats;
  badges: MeritBadge[];
}

interface MeritContextValue {
  records: MeritRecord[];
  profiles: Record<string, StudentProfile>;
  loading: boolean;
  recordsFor: (uid: string) => MeritRecord[];
  statsFor: (uid: string) => MeritStats;
  badgesFor: (uid: string) => MeritBadge[];
  profileFor: (uid: string) => StudentProfile | undefined;
  isTeacherUid: (uid: string) => boolean;
}

const MeritContext = createContext<MeritContextValue | null>(null);

export function MeritProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<MeritRecord[]>([]);
  const [profileList, setProfileList] = useState<StudentProfile[]>([]);
  const [recordsReady, setRecordsReady] = useState(false);
  const [profilesReady, setProfilesReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setProfileList([]);
      setRecordsReady(false);
      setProfilesReady(false);
      return;
    }

    setRecordsReady(false);
    setProfilesReady(false);

    const unsubRecords = watchAllMeritRecords((next) => {
      setRecords(next);
      setRecordsReady(true);
    });
    const unsubProfiles = watchMeritProfiles((next) => {
      setProfileList(next);
      setProfilesReady(true);
    });

    return () => {
      unsubRecords();
      unsubProfiles();
    };
  }, [user]);

  const profiles = useMemo(() => {
    const map: Record<string, StudentProfile> = {};
    for (const profile of profileList) map[profile.id] = profile;
    return map;
  }, [profileList]);

  const dataByStudent = useMemo(() => {
    const grouped: Record<string, MeritRecord[]> = {};
    for (const record of records) {
      (grouped[record.studentId] ||= []).push(record);
    }

    const result: Record<string, MeritUserData> = {};
    for (const [uid, studentRecords] of Object.entries(grouped)) {
      result[uid] = {
        records: studentRecords,
        stats: calculateMeritStats(studentRecords),
        badges: earnedMeritBadges(studentRecords),
      };
    }
    return result;
  }, [records]);

  const value = useMemo<MeritContextValue>(() => ({
    records,
    profiles,
    loading: !recordsReady || !profilesReady,
    recordsFor: (uid) => dataByStudent[uid]?.records || [],
    statsFor: (uid) => dataByStudent[uid]?.stats || EMPTY_STATS,
    badgesFor: (uid) => dataByStudent[uid]?.badges || [],
    profileFor: (uid) => profiles[uid],
    isTeacherUid: (uid) => profiles[uid]?.role === 'teacher',
  }), [dataByStudent, profiles, profilesReady, records, recordsReady]);

  return <MeritContext.Provider value={value}>{children}</MeritContext.Provider>;
}

export function useMeritContext() {
  const value = useContext(MeritContext);
  if (!value) throw new Error('useMeritContext must be used within MeritProvider');
  return value;
}
