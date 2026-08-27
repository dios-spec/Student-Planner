import { useEffect, useMemo, useState } from 'react';
import { useMeritContext } from '../context/MeritContext';
import {
  calculateMeritStats,
  earnedMeritBadges,
  watchClassMeritRecords,
  watchMeritRecords,
  type MeritStats,
} from '../firebase/merits';
import type { MeritRecord } from '../types';

const EMPTY_STATS: MeritStats = {
  merit: 0,
  demerit: 0,
  net: 0,
  meritAwards: 0,
  demeritAwards: 0,
};

/**
 * One student's Merit/Demerit.
 *
 * This used to read straight out of MeritContext, whose listener is the
 * school-wide `orderBy(createdAt desc) limit(400)` window. That window is fine
 * for a "recent activity" roster but it is NOT a per-student source of truth:
 * once the school passes 400 records, points earned earlier in the year fall
 * out of it, so a student's total silently shrinks and their earned badges
 * disappear from their own profile.
 *
 * Each single-student surface therefore subscribes to that student's own
 * records (`where('studentId','==',uid)`, no window). The context value is
 * still used as the immediate seed so nothing flashes empty while the
 * per-student snapshot lands, and for the teacher-vs-student check.
 */
export function useMeritRecords(uid: string | undefined | null) {
  const { loading: profilesLoading, profileFor, isTeacherUid } = useMeritContext();

  const resolvedUid = uid || '';
  const hasUid = !!uid;
  const isTeacherProfile = hasUid ? isTeacherUid(resolvedUid) : false;

  const [ownRecords, setOwnRecords] = useState<MeritRecord[] | null>(null);

  useEffect(() => {
    if (!uid) {
      setOwnRecords(null);
      return;
    }
    setOwnRecords(null);
    return watchMeritRecords(uid, setOwnRecords);
  }, [uid]);

  const records = ownRecords ?? [];

  const derived = useMemo(
    () => ({
      stats: records.length ? calculateMeritStats(records) : EMPTY_STATS,
      badges: records.length ? earnedMeritBadges(records) : [],
    }),
    [records]
  );

  return {
    records: hasUid ? records : [],
    stats: hasUid ? derived.stats : EMPTY_STATS,
    badges: hasUid && !isTeacherProfile ? derived.badges : [],
    // Only block on the context while we still need it for the teacher check.
    // Records are loading until this student's own snapshot lands; the
    // teacher/student distinction additionally needs the profile roster.
    loading: hasUid ? ownRecords === null || profilesLoading : false,
    profile: hasUid ? profileFor(resolvedUid) : undefined,
    isTeacherProfile,
  };
}

/** Profile roster for the teacher dashboard. Merit records are fetched
 *  separately, scoped to the class being viewed -- see useClassMeritRecords. */
export function useMeritRoster() {
  const { profiles, loading } = useMeritContext();
  return {
    profiles: Object.values(profiles),
    loading,
  };
}

/** Exact merit history for one class, for the teacher roster. */
export function useClassMeritRecords(classId: string) {
  const [records, setRecords] = useState<MeritRecord[] | null>(null);

  useEffect(() => {
    setRecords(null);
    return watchClassMeritRecords(classId, setRecords);
  }, [classId]);

  return { records: records ?? [], loading: records === null };
}
