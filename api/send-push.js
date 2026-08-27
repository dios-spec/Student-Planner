import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { adminApp, asStrings } from './_lib/firebaseAdmin.js';
import { checkPushAllowed } from './_lib/notificationGate.js';

const MAX_BODY_BYTES = 16384;
/** Notifications accepted in one request. Keeps the transaction and the FCM
 *  batch well inside their limits while collapsing a class fan-out from one
 *  serverless invocation per recipient into a handful. */
const MAX_BATCH = 50;
const MAX_TOKENS_PER_USER = 10;
const VALID_TYPES = new Set([
  'dm', 'groupMessage', 'reply', 'comment', 'groupInvite',
  'adminPromote', 'addedToGroup', 'homework', 'exam', 'announcement',
  'incomingCall', 'missedCall', 'postLike', 'classMessage',
  'classReaction', 'studyHelp', 'storyNew', 'reelLike', 'storyLike',
  // Control payload: tells the service worker to take a ringing call
  // notification off the lock screen. Never displayed.
  'callEnded',
]);

/** Types the recipient must not be able to mute into a stuck UI. */
const CONTROL_TYPES = new Set(['callEnded']);

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

/** Read the notification ids from either the single or the batch shape. */
function requestedIds(body) {
  const raw = Array.isArray(body.notificationIds)
    ? body.notificationIds
    : body.notificationId !== undefined
      ? [body.notificationId]
      : [];

  const ids = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) return null;
    if (!ids.includes(value)) ids.push(value);
  }
  return ids;
}

function messageDataFor(notificationId, notif) {
  // Custom data goes first; reserved routing/identity fields are written last
  // so notification data can never override them.
  return asStrings({
    ...safeExtra(notif.data),
    notificationId,
    type: notif.type,
    title: safeText(notif.title, 120, 'Buddy Planner'),
    body: safeText(notif.body, 500),
    icon: safeIcon(notif.icon),
    route: safeRoute(notif.route),
  });
}

function webpushOptionsFor(type) {
  const urgent = type === 'incomingCall' || type === 'callEnded';
  return {
    headers: {
      Urgency: urgent ? 'high' : 'normal',
      // A ring is worthless if it lands late; a dismissal is worthless if it
      // lands after the notification has already been tapped.
      TTL: type === 'incomingCall' ? '60' : type === 'callEnded' ? '120' : '86400',
    },
  };
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

    const ids = requestedIds(body);
    if (!ids || !ids.length) {
      return res.status(400).json({ error: 'Invalid notificationId' });
    }
    if (ids.length > MAX_BATCH) {
      return res.status(400).json({ error: `At most ${MAX_BATCH} notifications per request` });
    }

    const db = getFirestore();
    const refs = ids.map((id) => db.collection('notifications').doc(id));

    // Claim every notification in ONE transaction before delivery, so
    // refreshing or retrying cannot multiply-send. Previously this was one
    // transaction (and one whole HTTP request) per recipient.
    const claims = await db.runTransaction(async (tx) => {
      const snaps = await tx.getAll(...refs);
      const result = [];

      snaps.forEach((snap, index) => {
        const id = ids[index];
        if (!snap.exists) { result.push({ id, status: 'missing' }); return; }

        const notif = snap.data() || {};
        if (!notif.fromUid || notif.fromUid !== decoded.uid) {
          result.push({ id, status: 'mismatch' });
          return;
        }
        if (notif.pushAttemptedAt) { result.push({ id, status: 'duplicate' }); return; }

        tx.update(refs[index], { pushAttemptedAt: FieldValue.serverTimestamp() });
        result.push({ id, status: 'claimed', notif });
      });

      return result;
    });

    const claimed = claims.filter(
      (c) => c.status === 'claimed'
        && typeof c.notif.userId === 'string'
        && c.notif.userId
        && VALID_TYPES.has(c.notif.type)
    );

    if (!claimed.length) {
      const single = ids.length === 1 ? claims[0] : null;
      if (single && single.status === 'missing') {
        return res.status(404).json({ error: 'Notification not found' });
      }
      if (single && single.status === 'mismatch') {
        return res.status(403).json({ error: 'Sender mismatch' });
      }
      return res.status(200).json({ sent: 0, reason: 'nothing-to-send' });
    }

    // One read per distinct recipient instead of one per notification: a burst
    // of messages to the same person no longer re-reads their profile.
    const recipients = [...new Set(claimed.map((c) => c.notif.userId))];
    const userRefs = recipients.map((uid) => db.collection('users').doc(uid));
    const deviceRefs = recipients.map((uid) => db.collection('pushDevices').doc(uid));
    const snaps = await db.getAll(...userRefs, ...deviceRefs);

    const users = new Map();
    const devices = new Map();
    recipients.forEach((uid, i) => {
      const userSnap = snaps[i];
      const deviceSnap = snaps[recipients.length + i];
      users.set(uid, userSnap.exists ? (userSnap.data() || {}) : null);
      devices.set(uid, deviceSnap.exists ? (deviceSnap.data() || {}) : {});
    });

    // Opportunistically migrate legacy public-profile token fields.
    const migrations = [];
    for (const uid of recipients) {
      const user = users.get(uid);
      if (!user) continue;
      const legacy = uniqueTokens([
        ...(Array.isArray(user.fcmTokens) ? user.fcmTokens : []),
        ...(typeof user.fcmToken === 'string' ? [user.fcmToken] : []),
      ]);
      if (!legacy.length) continue;

      const device = devices.get(uid) || {};
      const merged = uniqueTokens([
        ...(Array.isArray(device.fcmTokens) ? device.fcmTokens : []),
        ...(typeof device.fcmToken === 'string' ? [device.fcmToken] : []),
        ...legacy,
      ]).slice(-MAX_TOKENS_PER_USER);

      devices.set(uid, { ...device, fcmTokens: merged, fcmToken: device.fcmToken || merged[merged.length - 1] });

      migrations.push(
        db.collection('pushDevices').doc(uid).set(
          { fcmTokens: merged, pushUpdatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        ),
        db.collection('users').doc(uid).update({
          fcmToken: FieldValue.delete(),
          fcmTokens: FieldValue.delete(),
          pushUpdatedAt: FieldValue.delete(),
        })
      );
    }
    if (migrations.length) await Promise.allSettled(migrations);

    // Build one flat list of messages, then hand FCM a single batch.
    const messages = [];
    const outcomes = [];

    for (const claim of claimed) {
      const notif = claim.notif;
      const user = users.get(notif.userId);

      if (!user) { outcomes.push({ id: claim.id, reason: 'no-user' }); continue; }

      // Control payloads bypass the preference gate: they exist to CLEAR a
      // notification, and a muted category must not be able to strand a
      // ringing call on someone's lock screen.
      if (!CONTROL_TYPES.has(notif.type)) {
        const gate = checkPushAllowed(user, notif.type);
        if (!gate.allowed) { outcomes.push({ id: claim.id, reason: gate.reason }); continue; }
      }

      const device = devices.get(notif.userId) || {};
      const tokens = uniqueTokens([
        ...(Array.isArray(device.fcmTokens) ? device.fcmTokens : []),
        ...(typeof device.fcmToken === 'string' ? [device.fcmToken] : []),
      ]).slice(-MAX_TOKENS_PER_USER);

      if (!tokens.length) { outcomes.push({ id: claim.id, reason: 'no-token' }); continue; }

      const data = messageDataFor(claim.id, notif);
      const webpush = webpushOptionsFor(notif.type);

      for (const token of tokens) {
        messages.push({ token, data, webpush });
        outcomes.push({ id: claim.id, token, pending: true });
      }
    }

    if (!messages.length) {
      return res.status(200).json({ sent: 0, failed: 0, cleaned: 0, notifications: claimed.length });
    }

    const result = await getMessaging().sendEach(messages);

    const invalidCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ]);

    const bad = new Set();
    result.responses.forEach((response, index) => {
      if (!response.success && response.error?.code && invalidCodes.has(response.error.code)) {
        bad.add(messages[index].token);
      }
    });

    if (bad.size) {
      const dead = [...bad];
      const cleanups = [];

      for (const uid of recipients) {
        const device = devices.get(uid) || {};
        const held = uniqueTokens([
          ...(Array.isArray(device.fcmTokens) ? device.fcmTokens : []),
          ...(typeof device.fcmToken === 'string' ? [device.fcmToken] : []),
        ]);
        const remove = held.filter((token) => bad.has(token));
        if (!remove.length) continue;

        const patch = {
          fcmTokens: FieldValue.arrayRemove(...remove),
          pushUpdatedAt: FieldValue.serverTimestamp(),
        };
        if (typeof device.fcmToken === 'string' && remove.includes(device.fcmToken)) {
          patch.fcmToken = FieldValue.delete();
        }
        // Keep the timestamped device list in step with the flat mirror,
        // otherwise a dead token would be resurrected by the next client write.
        if (Array.isArray(device.devices)) {
          patch.devices = device.devices.filter(
            (entry) => entry && typeof entry.token === 'string' && !bad.has(entry.token)
          );
        }

        cleanups.push(db.collection('pushDevices').doc(uid).set(patch, { merge: true }));
      }

      if (cleanups.length) await Promise.allSettled(cleanups);
      console.warn('[PUSH API] removed', dead.length, 'invalid token(s)');
    }

    return res.status(200).json({
      sent: result.successCount,
      failed: result.failureCount,
      cleaned: bad.size,
      notifications: claimed.length,
      skipped: outcomes.filter((o) => o.reason).length,
    });
  } catch (err) {
    console.error('[PUSH API]', err instanceof Error ? err.message : 'Unknown error');
    return res.status(500).json({ error: 'Push delivery failed' });
  }
}
