import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { adminApp, asStrings } from './_lib/firebaseAdmin.js';
import { checkPushAllowed } from './_lib/notificationGate.js';

const MAX_BODY_BYTES = 4096;
const VALID_TYPES = new Set([
  'dm', 'groupMessage', 'reply', 'comment', 'groupInvite',
  'adminPromote', 'addedToGroup', 'homework', 'exam', 'announcement',
  'incomingCall', 'missedCall', 'postLike', 'classMessage',
  'classReaction', 'studyHelp', 'storyNew', 'reelLike', 'storyLike',
]);

function safeText(value, max, fallback = '') {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function safeRoute(value) {
  const route = typeof value === 'string' ? value.trim() : '/';
  if (route === '/') return route;
  return /^\/[A-Za-z0-9]/.test(route) ? route.slice(0, 300) : '/';
}

function safeIcon(value) {
  if (typeof value !== 'string') return '';
  const icon = value.trim().slice(0, 1000);
  if (/^https:\/\/res\.cloudinary\.com\//.test(icon)) return icon;
  if (/^https:\/\/firebasestorage\.googleapis\.com\//.test(icon)) return icon;
  return '';
}

function safeExtra(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {};
  let count = 0;

  for (const [key, raw] of Object.entries(source)) {
    if (count >= 20) break;
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) continue;
    if (raw === undefined || raw === null) continue;
    out[key] = String(raw).slice(0, 1000);
    count += 1;
  }

  return out;
}

function uniqueTokens(source) {
  return [...new Set(source.filter((value) => typeof value === 'string' && value))].slice(0, 500);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request too large' });
  }

  let notifRef;

  try {
    adminApp();

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const decoded = await getAuth().verifyIdToken(authHeader.slice(7), true);

    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    if (JSON.stringify(body).length > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Request too large' });
    }

    const notificationId = body.notificationId;
    if (
      typeof notificationId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(notificationId)
    ) {
      return res.status(400).json({ error: 'Invalid notificationId' });
    }

    const db = getFirestore();
    notifRef = db.collection('notifications').doc(notificationId);

    // Claim once before delivery so refreshing/retrying the endpoint cannot
    // multiply-send the same notification.
    const claim = await db.runTransaction(async (tx) => {
      const snap = await tx.get(notifRef);
      if (!snap.exists) return { status: 'missing' };

      const notif = snap.data() || {};
      if (!notif.fromUid || notif.fromUid !== decoded.uid) {
        return { status: 'mismatch' };
      }
      if (notif.pushAttemptedAt) {
        return { status: 'duplicate' };
      }

      tx.update(notifRef, { pushAttemptedAt: FieldValue.serverTimestamp() });
      return { status: 'claimed', notif };
    });

    if (claim.status === 'missing') {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (claim.status === 'mismatch') {
      return res.status(403).json({ error: 'Sender mismatch' });
    }
    if (claim.status === 'duplicate') {
      return res.status(200).json({ sent: 0, reason: 'already-dispatched' });
    }

    const notif = claim.notif || {};
    if (!notif.userId || typeof notif.userId !== 'string') {
      return res.status(400).json({ error: 'Invalid recipient' });
    }
    if (!VALID_TYPES.has(notif.type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const userRef = db.collection('users').doc(notif.userId);
    const deviceRef = db.collection('pushDevices').doc(notif.userId);
    const [userSnap, deviceSnap] = await Promise.all([userRef.get(), deviceRef.get()]);

    if (!userSnap.exists) {
      return res.status(200).json({ sent: 0, reason: 'no-user' });
    }

    const user = userSnap.data() || {};
    const device = deviceSnap.exists ? (deviceSnap.data() || {}) : {};

    const gate = checkPushAllowed(user, notif.type);
    if (!gate.allowed) {
      return res.status(200).json({ sent: 0, reason: gate.reason });
    }

    const privateTokens = uniqueTokens([
      ...(Array.isArray(device.fcmTokens) ? device.fcmTokens : []),
      ...(typeof device.fcmToken === 'string' ? [device.fcmToken] : []),
    ]);
    const legacyTokens = uniqueTokens([
      ...(Array.isArray(user.fcmTokens) ? user.fcmTokens : []),
      ...(typeof user.fcmToken === 'string' ? [user.fcmToken] : []),
    ]);
    const tokens = uniqueTokens([...privateTokens, ...legacyTokens]);

    // Opportunistically migrate old public-profile token fields into the
    // private pushDevices document. Admin SDK bypasses client rules safely.
    if (legacyTokens.length) {
      const devicePatch = {
        fcmToken:
          typeof user.fcmToken === 'string' && user.fcmToken
            ? user.fcmToken
            : legacyTokens[0],
        fcmTokens: FieldValue.arrayUnion(...legacyTokens),
        pushUpdatedAt: FieldValue.serverTimestamp(),
      };

      await Promise.allSettled([
        deviceRef.set(devicePatch, { merge: true }),
        userRef.update({
          fcmToken: FieldValue.delete(),
          fcmTokens: FieldValue.delete(),
          pushUpdatedAt: FieldValue.delete(),
        }),
      ]);
    }

    if (!tokens.length) {
      return res.status(200).json({ sent: 0, reason: 'no-token' });
    }

    // Custom data goes first; reserved routing/identity fields are written
    // last so notification data can never override them.
    const data = asStrings({
      ...safeExtra(notif.data),
      notificationId,
      type: notif.type,
      title: safeText(notif.title, 120, 'Student Planner'),
      body: safeText(notif.body, 500),
      icon: safeIcon(notif.icon),
      route: safeRoute(notif.route),
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
    result.responses.forEach((response, index) => {
      if (
        !response.success &&
        response.error?.code &&
        invalidCodes.has(response.error.code)
      ) {
        bad.push(tokens[index]);
      }
    });

    if (bad.length) {
      const privatePatch = {
        fcmTokens: FieldValue.arrayRemove(...bad),
        pushUpdatedAt: FieldValue.serverTimestamp(),
      };
      if (typeof device.fcmToken === 'string' && bad.includes(device.fcmToken)) {
        privatePatch.fcmToken = FieldValue.delete();
      }

      const legacyPatch = { fcmTokens: FieldValue.arrayRemove(...bad) };
      if (typeof user.fcmToken === 'string' && bad.includes(user.fcmToken)) {
        legacyPatch.fcmToken = FieldValue.delete();
      }

      await Promise.allSettled([
        deviceRef.set(privatePatch, { merge: true }),
        userRef.update(legacyPatch),
      ]);
    }

    return res.status(200).json({
      sent: result.successCount,
      failed: result.failureCount,
      cleaned: bad.length,
    });
  } catch (err) {
    console.error('[PUSH API]', err instanceof Error ? err.message : 'Unknown error');

    // A transient failure can be manually retried by clearing the claim in
    // Firebase Console. We do not expose a client route for changing it.
    return res.status(500).json({ error: 'Push delivery failed' });
  }
}
