import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { ensureAnonymousUser } from '../firebase/config';
import { ensureUserProfile, watchUserProfile, touchLastSeen } from '../firebase/users';
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
        unsubProfile = watchUserProfile(fbUser.uid, (p) => {
          setProfile(p);
          setLoading(false);
        });
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
