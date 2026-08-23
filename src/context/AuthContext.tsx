import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { ensureAnonymousUser } from '../firebase/config';
import { ensureUserProfile, watchUserProfile, touchLastSeen, syncTimezone } from '../firebase/users';

const HEARTBEAT_MS = 60000;
import type { StudentProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: StudentProfile | null;
  loading: boolean;
  isFirstVisit: boolean;
  dismissWelcome: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    ensureAnonymousUser()
      .then(async (fbUser) => {
        setUser(fbUser);
        const seenBefore = localStorage.getItem('sbp_seen_welcome');
        if (!seenBefore) setIsFirstVisit(true);
        await ensureUserProfile(fbUser.uid);
        touchLastSeen(fbUser.uid);
        syncTimezone(fbUser.uid);
        unsubProfile = watchUserProfile(fbUser.uid, (p) => {
          setProfile(p);
          setLoading(false);
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
          cleanupHeartbeat();
        };
      })
      .catch((err) => {
        console.error('Auth failed', err);
        setLoading(false);
      });

    return () => unsubProfile?.();
  }, []);

  const dismissWelcome = () => {
    localStorage.setItem('sbp_seen_welcome', '1');
    setIsFirstVisit(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isFirstVisit, dismissWelcome }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
