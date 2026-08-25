import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  type User,
} from 'firebase/auth';

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
export async function linkAnonymousUserToGoogle(user: User): Promise<User> {
  if (accountTypeForFirebaseUser(user) !== 'anonymous') return user;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await linkWithPopup(user, provider);

  if (result.user.uid !== user.uid) {
    throw new Error('Firebase UID changed unexpectedly during account linking');
  }

  return result.user;
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
