import { useMeritContext } from '../context/MeritContext';

export function useMeritRecords(uid: string | undefined | null) {
  const {
    loading,
    recordsFor,
    statsFor,
    badgesFor,
    profileFor,
    isTeacherUid,
  } = useMeritContext();

  const hasUid = !!uid;
  const resolvedUid = uid || '';
  const isTeacherProfile = hasUid ? isTeacherUid(resolvedUid) : false;

  return {
    records: hasUid ? recordsFor(resolvedUid) : [],
    stats: statsFor(resolvedUid),
    badges: hasUid && !isTeacherProfile ? badgesFor(resolvedUid) : [],
    loading: hasUid ? loading : false,
    profile: hasUid ? profileFor(resolvedUid) : undefined,
    isTeacherProfile,
  };
}

export function useMeritRoster() {
  const { profiles, records, loading } = useMeritContext();
  return {
    profiles: Object.values(profiles),
    records,
    loading,
  };
}
