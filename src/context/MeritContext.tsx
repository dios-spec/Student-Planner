import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { watchMeritProfiles } from '../firebase/merits';
import type { StudentProfile } from '../types';

/**
 * Live profile roster, shared app-wide.
 *
 * This context used to ALSO hold a school-wide merit listener (the newest 400
 * records). That was wrong twice over: it was mounted for every user on every
 * app open, so every student downloaded school-wide merit history they never
 * saw; and it was used as a per-student source of truth, so once the school
 * passed 400 records, totals and earned badges silently shrank for anyone
 * whose points were awarded earlier in the year.
 *
 * Merit records are now read by whoever actually needs them, at the right
 * scope: useMeritRecords(uid) subscribes to one student, and MeritPage's
 * teacher roster subscribes to one class. Profiles stay here because names and
 * avatars really are needed everywhere.
 */
interface MeritContextValue {
  profiles: Record<string, StudentProfile>;
  loading: boolean;
  profileFor: (uid: string) => StudentProfile | undefined;
  isTeacherUid: (uid: string) => boolean;
}

const MeritContext = createContext<MeritContextValue | null>(null);

export function MeritProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profileList, setProfileList] = useState<StudentProfile[]>([]);
  const [profilesReady, setProfilesReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfileList([]);
      setProfilesReady(false);
      return;
    }

    setProfilesReady(false);

    return watchMeritProfiles((next) => {
      setProfileList(next);
      setProfilesReady(true);
    });
  }, [user]);

  const profiles = useMemo(() => {
    const map: Record<string, StudentProfile> = {};
    for (const profile of profileList) map[profile.id] = profile;
    return map;
  }, [profileList]);

  const value = useMemo<MeritContextValue>(() => ({
    profiles,
    loading: !profilesReady,
    profileFor: (uid) => profiles[uid],
    isTeacherUid: (uid) => profiles[uid]?.role === 'teacher',
  }), [profiles, profilesReady]);

  return <MeritContext.Provider value={value}>{children}</MeritContext.Provider>;
}

export function useMeritContext() {
  const value = useContext(MeritContext);
  if (!value) throw new Error('useMeritContext must be used within MeritProvider');
  return value;
}
