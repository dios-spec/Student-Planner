import { signOut, type User } from 'firebase/auth';
import { auth } from './config';
import { clearIceCache } from './iceConfig';

export class AccountDeletionError extends Error {
  code: string;
  constructor(message: string, code = 'server_error') {
    super(message);
    this.name = 'AccountDeletionError';
    this.code = code;
  }
}

function friendlyMessage(status: number, code: string): string {
  if (code === 'invalid_token' || status === 401) {
    return 'Your session has expired. Reload Buddy Planner and try again.';
  }
  if (code === 'not_confirmed' || status === 400) {
    return 'Deletion was not confirmed. Type DELETE exactly and try again.';
  }
  return 'Your account could not be deleted. Nothing has been lost — try again, and if it keeps failing tell your teacher.';
}

/**
 * Deletes this account, permanently.
 *
 * The uid is NEVER sent in the request body: the server takes it only from the
 * verified ID token, so there is no shape of request that deletes somebody
 * else. The token is force-refreshed first and the server checks it for
 * revocation, so a stale or revoked session cannot destroy an account.
 */
export async function deleteMyAccount(user: User): Promise<void> {
  const idToken = await user.getIdToken(true);

  let response: Response;
  try {
    response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  } catch {
    throw new AccountDeletionError(
      'Deleting your account needs an internet connection. Check your connection and try again.',
      'network_error'
    );
  }

  const payload = (await response.json().catch(() => ({}))) as { deleted?: boolean; code?: string };

  if (!response.ok || payload.deleted !== true) {
    throw new AccountDeletionError(
      friendlyMessage(response.status, payload.code || ''),
      payload.code || 'server_error'
    );
  }

  // The Firebase identity is gone server-side, but this tab still holds a token
  // that stays syntactically valid for up to an hour. Drop it immediately, and
  // discard any relay credentials issued to the account that just went away.
  clearIceCache();
  await signOut(auth).catch(() => {});
}
