import {
  EmailAuthProvider,
  GoogleAuthProvider,
  getRedirectResult,
  linkWithCredential,
  linkWithPopup,
  linkWithRedirect,
  type User,
} from 'firebase/auth';
import { auth } from './config';

const GOOGLE_LINK_UID_KEY = 'sbp_google_link_uid';

function shouldUseGoogleRedirect(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true;

  return mobile || standalone;
}

export type AccountType = 'anonymous' | 'google' | 'email';

export function accountTypeForFirebaseUser(user: User | null): AccountType {
  if (!user) return 'anonymous';

  const providers = new Set(user.providerData.map((item) => item.providerId));

  if (providers.has('google.com')) return 'google';
  if (providers.has('password')) return 'email';

  return 'anonymous';
}

export async function syncAccountProvider(user: User): Promise<AccountType> {
  const token = await user.getIdToken(true);
  const response = await fetch('/api/sync-account-provider', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof body?.error === 'string'
        ? body.error
        : 'Could not sync account provider'
    );
  }

  if (body.accountType === 'google') return 'google';
  if (body.accountType === 'email') return 'email';
  return 'anonymous';
}

/**
 * Upgrades the CURRENT anonymous Firebase user by linking Google.
 * linkWithPopup preserves the same Firebase UID and therefore the same
 * Buddy Planner profile/data.
 */
export async function linkAnonymousUserToGoogle(user: User): Promise<User | null> {
  if (accountTypeForFirebaseUser(user) !== 'anonymous') return user;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (shouldUseGoogleRedirect()) {
    // sessionStorage survives the OAuth navigation but is scoped to this tab/app.
    // It is used only as a safety assertion; Firebase remains the auth authority.
    window.sessionStorage.setItem(GOOGLE_LINK_UID_KEY, user.uid);

    await linkWithRedirect(user, provider);

    // Normally navigation has started before this point. Returning null prevents
    // callers from accidentally treating the still-anonymous pre-redirect user
    // as successfully linked.
    return null;
  }

  const result = await linkWithPopup(user, provider);

  if (result.user.uid !== user.uid) {
    throw new Error('Firebase UID changed unexpectedly during account linking');
  }

  return result.user;
}

/**
 * Completes a Google link started with linkWithRedirect().
 * Returns null when this page load was not returning from Google OAuth.
 */
export async function completePendingGoogleLink(): Promise<User | null> {
  const expectedUid =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem(GOOGLE_LINK_UID_KEY)
      : null;

  try {
    const result = await getRedirectResult(auth);

    if (!result) return null;

    if (expectedUid && result.user.uid !== expectedUid) {
      throw new Error(
        'Firebase UID changed unexpectedly while completing Google linking'
      );
    }

    return result.user;
  } finally {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(GOOGLE_LINK_UID_KEY);
    }
  }
}

export async function linkAnonymousUserToEmail(
  user: User,
  email: string,
  password: string
): Promise<User> {
  if (accountTypeForFirebaseUser(user) !== 'anonymous') return user;

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Enter your email address');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');

  const credential = EmailAuthProvider.credential(cleanEmail, password);
  const result = await linkWithCredential(user, credential);

  if (result.user.uid !== user.uid) {
    throw new Error('Firebase UID changed unexpectedly during account linking');
  }

  return result.user;
}
