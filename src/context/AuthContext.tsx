import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getIdTokenResult, onIdTokenChanged, type User } from 'firebase/auth';
import { auth, ensureAnonymousUser } from '../firebase/config';
import { ensureUserProfile, watchUserProfile, touchLastSeen, syncTimezone } from '../firebase/users';
import { verifyTeacherPassword } from '../firebase/teacherVerification';
import {
  accountTypeForFirebaseUser,
  completePendingGoogleLink,
  linkAnonymousUserToEmail,
  linkAnonymousUserToGoogle,
  syncAccountProvider,
  type AccountType,
} from '../firebase/accountLinking';
import { clearSnapshotCache } from '../hooks/useCachedSnapshot';
import { invalidateRosterCache } from '../firebase/notifications';
import { setSfxEnabled } from '../utils/sfx';

const HEARTBEAT_MS = 60000;
import type { AppRole, StudentProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: StudentProfile | null;
  loading: boolean;
  claimsLoading: boolean;
  role: AppRole;
  isTeacher: boolean;
  isAnonymous: boolean;
  accountType: AccountType;
  isFirstVisit: boolean;
  refreshClaims: () => Promise<AppRole>;
  verifyTeacher: (password: string) => Promise<void>;
  linkGoogleAccount: () => Promise<void>;
  linkEmailAccount: (email: string, password: string) => Promise<void>;
  dismissWelcome: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  // Keep the UI sound layer in sync with the user's own notification
  // preference, so muting call sound also mutes interface sounds.
  useEffect(() => {
    setSfxEnabled(profile?.notificationSettings?.sound !== false);
  }, [profile?.notificationSettings?.sound]);
  const [loading, setLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [role, setRole] = useState<AppRole>('student');
  const roleRef = useRef<AppRole>('student');

  /**
   * Single place where the role actually changes.
   *
   * Students and teachers read different collections (messages vs
   * teacherMessages, merit visibility, class rosters). The manual verification
   * path cleared the role-scoped caches, but the automatic token-refresh path
   * did not — so when an administrator removed a teacher claim, Firebase
   * silently renewed the token, the role flipped to 'student', and the module
   * level snapshot cache kept serving teacher-scoped data to the demoted user.
   */
  const applyRole = useCallback((nextRole: AppRole) => {
    if (roleRef.current === nextRole) return;
    roleRef.current = nextRole;
    clearSnapshotCache();
    invalidateRosterCache();
    setRole(nextRole);
  }, []);
  const [accountType, setAccountType] = useState<AccountType>('anonymous');
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | undefined;

    /**
     * The previous implementation did `let unsubProfile; ... return () =>
     * unsubProfile?.()`. unsubProfile is only assigned deep inside an async
     * promise chain, but the cleanup function runs synchronously at unmount —
     * so if auth had not resolved yet the cleanup was a no-op and EVERYTHING
     * created afterwards leaked forever: the profile onSnapshot listener, the
     * onIdTokenChanged listener, the 60s lastSeen heartbeat (still writing to
     * Firestore) and the visibilitychange handler. React StrictMode mounts,
     * unmounts and remounts, so this leaked on every single dev page load.
     */
    const registerTeardown = (fn: () => void) => {
      if (cancelled) {
        fn();
        return;
      }
      teardown = fn;
    };

    completePendingGoogleLink()
      .catch((error) => {
        // A failed Google redirect link must not abort sign-in. Rethrowing here
        // skipped ensureAnonymousUser() entirely, so `user` stayed null forever
        // and every page rendered its `if (!user) return null` branch — a blank
        // app with no error and no recovery short of a manual reload.
        console.error('Could not complete Google account linking', error);
        return null;
      })
      .then((redirectUser) => redirectUser || ensureAnonymousUser())
      .then(async (fbUser) => {
        if (cancelled) return;

        setUser(fbUser);
        const seenBefore = localStorage.getItem('sbp_seen_welcome');
        if (!seenBefore) setIsFirstVisit(true);
        try {
          const tokenResult = await getIdTokenResult(fbUser);
          applyRole(tokenResult.claims.role === 'teacher' ? 'teacher' : 'student');
        } catch (error) {
          console.warn('Could not read role claim', error);
          applyRole('student');
        } finally {
          setClaimsLoading(false);
        }

        if (cancelled) return;

        await ensureUserProfile(fbUser.uid);

        if (cancelled) return;

        // Client providerData gives an immediate, factual account state.
        // The server then verifies it with Firebase Admin and syncs the
        // public profile badge without trusting a client-written field.
        setAccountType(accountTypeForFirebaseUser(fbUser));
        syncAccountProvider(fbUser)
          .then((next) => {
            if (!cancelled) setAccountType(next);
          })
          .catch((error) => {
            console.warn('Could not sync account provider', error);
          });
        touchLastSeen(fbUser.uid);
        syncTimezone(fbUser.uid);

        const unsubscribeProfile = watchUserProfile(
          fbUser.uid,
          (p) => {
            setProfile(p);
            setLoading(false);
          },
          () => {
            // The listener is dead and will never fire again. Release the
            // loading gate so the app renders instead of spinning forever.
            setLoading(false);
          }
        );

        // Keep the role UI in sync when Firebase automatically renews a token
        // (including when an administrator later removes a claim).
        const unsubscribeClaims = onIdTokenChanged(auth, (changedUser) => {
          if (!changedUser || changedUser.uid !== fbUser.uid) {
            applyRole('student');
            return;
          }
          getIdTokenResult(changedUser)
            .then((tokenResult) => {
              applyRole(tokenResult.claims.role === 'teacher' ? 'teacher' : 'student');
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

        registerTeardown(() => {
          unsubscribeProfile();
          unsubscribeClaims();
          window.clearInterval(heartbeat);
          document.removeEventListener('visibilitychange', onVisible);
        });
      })
      .catch((err) => {
        console.error('Auth failed', err);
        setClaimsLoading(false);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [applyRole]);

  const refreshClaims = useCallback(async (): Promise<AppRole> => {
    if (!user) return 'student';
    setClaimsLoading(true);
    try {
      const tokenResult = await getIdTokenResult(user, true);
      const nextRole: AppRole = tokenResult.claims.role === 'teacher' ? 'teacher' : 'student';
      applyRole(nextRole);
      return nextRole;
    } finally {
      setClaimsLoading(false);
    }
  }, [applyRole, user]);

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

  const linkGoogleAccount = useCallback(async (): Promise<void> => {
    if (!user) throw new Error('No signed-in user');
    if (!user.isAnonymous) return;

    const originalUid = user.uid;
    const linkedUser = await linkAnonymousUserToGoogle(user);

    // Mobile/TWA uses linkWithRedirect(), which navigates away and completes
    // on the next page load. There is no linked user to sync on this page yet.
    if (!linkedUser) return;

    if (linkedUser.uid !== originalUid) {
      throw new Error('Account linking changed the Firebase UID unexpectedly');
    }

    setUser(linkedUser);
    // The Firebase link has already succeeded and cannot be undone. Trust the
    // client's providerData immediately; the server sync only refreshes the
    // public badge, so a transient 500 there must not surface to the user as
    // "linking failed" and leave the upgrade prompt nagging a linked account.
    setAccountType(accountTypeForFirebaseUser(linkedUser));
    syncAccountProvider(linkedUser)
      .then(setAccountType)
      .catch((error) => console.warn('Could not sync account provider', error));
  }, [user]);

  const linkEmailAccount = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (!user) throw new Error('No signed-in user');
      if (accountTypeForFirebaseUser(user) !== 'anonymous') return;

      const originalUid = user.uid;
      const linkedUser = await linkAnonymousUserToEmail(user, email, password);

      if (linkedUser.uid !== originalUid) {
        throw new Error('Account linking changed the Firebase UID unexpectedly');
      }

      setUser(linkedUser);
      setAccountType(accountTypeForFirebaseUser(linkedUser));
      syncAccountProvider(linkedUser)
        .then(setAccountType)
        .catch((error) => console.warn('Could not sync account provider', error));
    },
    [user]
  );

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
        isAnonymous: accountType === 'anonymous',
        accountType,
        isFirstVisit,
        refreshClaims,
        verifyTeacher,
        linkGoogleAccount,
        linkEmailAccount,
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
