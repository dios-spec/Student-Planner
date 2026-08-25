import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from './_lib/firebaseAdmin.js';

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const app = adminApp();
    const adminAuth = getAuth(app);
    const decoded = await adminAuth.verifyIdToken(token);
    const record = await adminAuth.getUser(decoded.uid);

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
    return res.status(500).json({ error: 'Could not sync account provider' });
  }
}
