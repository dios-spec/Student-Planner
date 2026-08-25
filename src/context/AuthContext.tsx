import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getIdTokenResult, onIdTokenChanged, type User } from 'firebase/auth';
import { auth, ensureAnonymousUser } from '../firebase/config';
import { ensureUserProfile, watchUserProfile, touchLastSeen, syncTimezone } from '../firebase/users';
import { verifyTeacherPassword } from '../firebase/teacherVerification';
import { clearSnapshotCache } from '../hooks/useCachedSnapshot';

const HEARTBEAT_MS = 60000;
import type { AppRole, StudentProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: StudentProfile | null;
  loading: boolean;
  claimsLoading: boolean;
  role: AppRole;
  isTeacher: boolean;
  isFirstVisit: boolean;
  refreshClaims: () => Promise<AppRole>;
  verifyTeacher: (password: string) => Promise<void>;
  dismissWelcome: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [role, setRole] = useState<AppRole>('student');
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    ensureAnonymousUser()
      .then(async (fbUser) => {
        setUser(fbUser);
        const seenBefore = localStorage.getItem('sbp_seen_welcome');
        if (!seenBefore) setIsFirstVisit(true);
        try {
          const tokenResult = await getIdTokenResult(fbUser);
          setRole(tokenResult.claims.role === 'teacher' ? 'teacher' : 'student');
        } catch (error) {
          console.warn('Could not read role claim', error);
          setRole('student');
        } finally {
          setClaimsLoading(false);
        }
        await ensureUserProfile(fbUser.uid);
        touchLastSeen(fbUser.uid);
        syncTimezone(fbUser.uid);
        unsubProfile = watchUserProfile(fbUser.uid, (p) => {
          setProfile(p);
          setLoading(false);
        });

        // Keep the role UI in sync when Firebase automatically renews a token
        // (including when an administrator later removes a claim).
        const unsubscribeClaims = onIdTokenChanged(auth, (changedUser) => {
          if (!changedUser || changedUser.uid !== fbUser.uid) {
            setRole('student');
            return;
          }
          getIdTokenResult(changedUser)
            .then((tokenResult) => {
              setRole(tokenResult.claims.role === 'teacher' ? 'teacher' : 'student');
            })
            .catch((error) => console.warn('Could not refresh role claim', error));
        });

        // Keep lastSeen fresh so presence (online/last-seen) reflects reality,
        // not just the moment the tab first loaded. Only while visible --
        // no point burning writes on a backgrounded/closed tab.
        const heartbeat = window.setInterval(() => {
          if (document.visibilityState === 'visible') touchLastSeen(fbUser.uid);
        }, HEARTBEAT_MS);
        const onVisible = () => {
          if (document.visibilityState === 'visible') touchLastSeen(fbUser.uid);
        };
        document.addEventListener('visibilitychange', onVisible);

        const cleanupHeartbeat = () => {
          window.clearInterval(heartbeat);
          document.removeEventListener('visibilitychange', onVisible);
        };
        const prevUnsub = unsubProfile;
        unsubProfile = () => {
          prevUnsub?.();
          unsubscribeClaims();
          cleanupHeartbeat();
        };
      })
      .catch((err) => {
        console.error('Auth failed', err);
        setClaimsLoading(false);
        setLoading(false);
      });

    return () => unsubProfile?.();
  }, []);

  const refreshClaims = useCallback(async (): Promise<AppRole> => {
    if (!user) return 'student';
    setClaimsLoading(true);
    try {
      const tokenResult = await getIdTokenResult(user, true);
      const nextRole: AppRole = tokenResult.claims.role === 'teacher' ? 'teacher' : 'student';
      // BUG-15: student and teacher see different collections (messages vs
      // teacherMessages, merit visibility, etc). Cached snapshots from the old
      // role must not survive the switch.
      if (nextRole !== role) clearSnapshotCache();
      setRole(nextRole);
      return nextRole;
    } finally {
      setClaimsLoading(false);
    }
  }, [user, role]);

  const verifyTeacher = useCallback(async (password: string): Promise<void> => {
    if (!user) throw new Error('No signed-in user');
    setClaimsLoading(true);
    try {
      await verifyTeacherPassword(user, password);
      const nextRole = await refreshClaims();
      if (nextRole !== 'teacher') throw new Error('Teacher claim did not refresh');
    } finally {
      setClaimsLoading(false);
    }
  }, [refreshClaims, user]);

  const dismissWelcome = () => {
    localStorage.setItem('sbp_seen_welcome', '1');
    setIsFirstVisit(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        claimsLoading,
        role,
        isTeacher: role === 'teacher',
        isFirstVisit,
        refreshClaims,
        verifyTeacher,
        dismissWelcome,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
