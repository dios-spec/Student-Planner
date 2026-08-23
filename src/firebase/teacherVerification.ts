import { getIdToken, type User } from 'firebase/auth';

interface VerificationResponse {
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
  role?: string;
  verified?: boolean;
}

export class TeacherVerificationError extends Error {
  code: string;
  retryAfterSeconds?: number;

  constructor(message: string, code = 'verification_failed', retryAfterSeconds?: number) {
    super(message);
    this.name = 'TeacherVerificationError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function friendlyMessage(status: number, payload: VerificationResponse): string {
  if (payload.code === 'rate_limited' || status === 429) {
    const minutes = Math.max(1, Math.ceil((payload.retryAfterSeconds || 60) / 60));
    return `Too many attempts. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  if (payload.code === 'invalid_password' || status === 403) {
    return 'That teacher password was not accepted.';
  }
  if (payload.code === 'not_configured' || status === 503) {
    return 'Teacher verification is not configured on the server yet.';
  }
  if (status === 401) return 'Your session expired. Reload the app and try again.';
  if (status === 400) return 'Enter the teacher password and try again.';
  return payload.error || 'Teacher verification failed. Try again.';
}

export async function verifyTeacherPassword(user: User, password: string): Promise<void> {
  if (!password || password.length > 256) {
    throw new TeacherVerificationError('Enter the teacher password and try again.', 'invalid_request');
  }

  const idToken = await getIdToken(user, true);
  let response: Response;

  try {
    response = await fetch('/api/verify-teacher', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new TeacherVerificationError(
      'Teacher verification needs an internet connection. Check your connection and try again.',
      'network_error'
    );
  }

  let payload: VerificationResponse = {};
  try {
    payload = (await response.json()) as VerificationResponse;
  } catch {
    // The status code still gives us a safe fallback message.
  }

  if (!response.ok || payload.verified !== true || payload.role !== 'teacher') {
    throw new TeacherVerificationError(
      friendlyMessage(response.status, payload),
      payload.code || 'verification_failed',
      payload.retryAfterSeconds
    );
  }
}
