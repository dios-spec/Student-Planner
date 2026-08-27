import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from './_lib/firebaseAdmin.js';

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Auth error codes that mean "reauthenticate", not "the server is broken". */
const AUTH_ERROR_CODES = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/user-disabled',
  'auth/user-not-found',
]);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token', code: 'invalid_token' });
  }

  let app;
  let adminAuth;
  let decoded;
  let record;

  try {
    app = adminApp();
    adminAuth = getAuth(app);

    // Token verification is its own try/catch. It used to share the single
    // catch-all below, so an expired or malformed token -- an ordinary,
    // expected condition -- was answered with 500 "Could not sync account
    // provider". The client could not tell "sign in again" from "the backend
    // is down", and it polluted error monitoring.
    //
    // checkRevoked is now true, matching verify-teacher.js. Without it a token
    // from a revoked or disabled session stayed usable for up to an hour.
    decoded = await adminAuth.verifyIdToken(token, true);
    record = await adminAuth.getUser(decoded.uid);
  } catch (error) {
    const code = error && typeof error === 'object' ? String(error.code || '') : '';
    if (AUTH_ERROR_CODES.has(code)) {
      return res.status(401).json({ error: 'Invalid or expired session', code: 'invalid_token' });
    }
    console.error('[ACCOUNT] token verification failed', code || error);
    return res.status(500).json({ error: 'Could not sync account provider', code: 'server_error' });
  }

  try {
    const providerIds = new Set(
      record.providerData.map((provider) => provider.providerId)
    );

    const accountType = providerIds.has('google.com')
      ? 'google'
      : providerIds.has('password')
        ? 'email'
        : 'anonymous';

    await getFirestore(app)
      .collection('users')
      .doc(decoded.uid)
      .set({ accountType }, { merge: true });

    return res.status(200).json({ ok: true, accountType });
  } catch (error) {
    console.error('[ACCOUNT] provider sync failed', error);
    return res.status(500).json({ error: 'Could not sync account provider', code: 'server_error' });
  }
}
