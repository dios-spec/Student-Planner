import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { adminApp, asStrings } from './_lib/firebaseAdmin.js';
import { checkPushAllowed } from './_lib/notificationGate.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    adminApp();

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const notificationId = body.notificationId;

    if (!notificationId || typeof notificationId !== 'string') {
      return res.status(400).json({ error: 'notificationId required' });
    }

    const db = getFirestore();
    const notifRef = db.collection('notifications').doc(notificationId);
    const notifSnap = await notifRef.get();

    if (!notifSnap.exists) return res.status(404).json({ error: 'Notification not found' });

    const notif = notifSnap.data();

    if (!notif?.fromUid || notif.fromUid !== decoded.uid) {
      return res.status(403).json({ error: 'Sender mismatch' });
    }

    if (!notif.userId || typeof notif.userId !== 'string') {
      return res.status(400).json({ error: 'Invalid recipient' });
    }

    const userRef = db.collection('users').doc(notif.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(200).json({ sent: 0, reason: 'no-user' });

    const user = userSnap.data() || {};

    const gate = checkPushAllowed(user, notif.type);
    if (!gate.allowed) {
      return res.status(200).json({ sent: 0, reason: gate.reason });
    }

    const tokens = [
      ...(Array.isArray(user.fcmTokens) ? user.fcmTokens : []),
      ...(typeof user.fcmToken === 'string' ? [user.fcmToken] : []),
    ].filter((v, i, a) => typeof v === 'string' && v && a.indexOf(v) === i);

    if (!tokens.length) return res.status(200).json({ sent: 0, reason: 'no-token' });

    const extra = asStrings(notif.data || {});
    const data = asStrings({
      notificationId,
      type: notif.type || 'dm',
      title: notif.title || 'Student Planner',
      body: notif.body || '',
      icon: notif.icon || '',
      route: notif.route || '/',
      ...extra,
    });

    const isCall = notif.type === 'incomingCall';

    const result = await getMessaging().sendEachForMulticast({
      tokens,
      data,
      webpush: {
        headers: {
          Urgency: isCall ? 'high' : 'normal',
          TTL: isCall ? '60' : '86400',
        },
      },
    });

    const invalidCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ]);

    const bad = [];
    result.responses.forEach((r, i) => {
      if (!r.success && r.error?.code && invalidCodes.has(r.error.code)) bad.push(tokens[i]);
    });

    if (bad.length) {
      const patch = { fcmTokens: FieldValue.arrayRemove(...bad) };
      if (typeof user.fcmToken === 'string' && bad.includes(user.fcmToken)) {
        patch.fcmToken = FieldValue.delete();
      }
      await userRef.update(patch).catch(() => {});
    }

    return res.status(200).json({
      sent: result.successCount,
      failed: result.failureCount,
      cleaned: bad.length,
    });
  } catch (err) {
    console.error('[PUSH API]', err);
    return res.status(500).json({ error: 'Push delivery failed' });
  }
}
