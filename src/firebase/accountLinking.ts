import {
  GoogleAuthProvider,
  linkWithPopup,
  type User,
} from 'firebase/auth';

export type AccountType = 'anonymous' | 'google';

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

  return body.accountType === 'google' ? 'google' : 'anonymous';
}

/**
 * Upgrades the CURRENT anonymous Firebase user by linking Google.
 * linkWithPopup preserves the same Firebase UID and therefore the same
 * Buddy Planner profile/data.
 */
export async function linkAnonymousUserToGoogle(user: User): Promise<User> {
  if (!user.isAnonymous) return user;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await linkWithPopup(user, provider);

  if (result.user.uid !== user.uid) {
    throw new Error('Firebase UID changed unexpectedly during account linking');
  }

  return result.user;
}
