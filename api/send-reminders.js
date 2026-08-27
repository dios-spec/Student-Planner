import { adminApp, asStrings } from './_lib/firebaseAdmin.js';
import { checkPushAllowed } from './_lib/notificationGate.js';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const MAX_TOKENS_PER_USER = 10;
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

function tokensFrom(device, user) {
  return [...new Set(
    []
      .concat(Array.isArray(device?.fcmTokens) ? device.fcmTokens : [])
      .concat(typeof device?.fcmToken === 'string' ? [device.fcmToken] : [])
      .concat(Array.isArray(user?.fcmTokens) ? user.fcmTokens : [])
      .concat(typeof user?.fcmToken === 'string' ? [user.fcmToken] : [])
      .filter((v) => typeof v === 'string' && v)
  )].slice(-MAX_TOKENS_PER_USER);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    adminApp();
    const db = getFirestore();
    const now = Timestamp.now();

    const dueSnap = await db.collection('reminders')
      .where('sent', '==', false)
      .where('remindAt', '<=', now)
      .limit(200)
      .get();

    if (dueSnap.empty) {
      return res.status(200).json({ processed: 0 });
    }

    const due = dueSnap.docs.filter((d) => typeof (d.data() || {}).userId === 'string');

    // One read per distinct recipient instead of two reads per reminder. A
    // student with five reminders firing in the same minute used to cost ten
    // document reads; it now costs two.
    const recipients = [...new Set(due.map((d) => d.data().userId))];
    const snaps = await db.getAll(
      ...recipients.map((uid) => db.collection('users').doc(uid)),
      ...recipients.map((uid) => db.collection('pushDevices').doc(uid))
    );

    const users = new Map();
    const devices = new Map();
    recipients.forEach((uid, i) => {
      users.set(uid, snaps[i].exists ? (snaps[i].data() || {}) : null);
      devices.set(uid, snaps[recipients.length + i].exists ? (snaps[recipients.length + i].data() || {}) : {});
    });

    const notifBatch = db.batch();
    const messages = [];
    let processed = 0;

    for (const docSnap of due) {
      const r = docSnap.data();
      const title = 'Reminder';
      const body = r.itemTitle || 'You asked to be reminded about this';

      notifBatch.set(db.collection('notifications').doc(), {
        userId: r.userId,
        type: 'reminder',
        title,
        body,
        route: '/planner',
        fromUid: r.userId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      const user = users.get(r.userId);
      // Use the SHARED gate rather than a second, hand-rolled copy of the
      // quiet-hours rule. The old inline check ignored category preferences
      // and could drift from the one /api/send-push applies.
      const gate = user ? checkPushAllowed(user, 'reminder') : { allowed: false, reason: 'no-user' };

      if (gate.allowed) {
        const tokens = tokensFrom(devices.get(r.userId), user);
        const data = asStrings({ type: 'reminder', title, body, route: '/planner' });
        for (const token of tokens) {
          messages.push({ token, data, webpush: { headers: { Urgency: 'normal', TTL: '86400' } } });
        }
      }

      processed += 1;
    }

    await notifBatch.commit();

    let sent = 0;
    let cleaned = 0;

    if (messages.length) {
      const result = await getMessaging().sendEach(messages);
      sent = result.successCount;

      // The reminder path never cleaned up dead tokens, so a stale token was
      // retried by this cron every single time it fired, forever.
      const bad = new Set();
      result.responses.forEach((response, index) => {
        if (!response.success && response.error?.code && INVALID_TOKEN_CODES.has(response.error.code)) {
          bad.add(messages[index].token);
        }
      });

      if (bad.size) {
        const cleanups = [];
        for (const uid of recipients) {
          const device = devices.get(uid) || {};
          const held = tokensFrom(device, users.get(uid));
          const remove = held.filter((token) => bad.has(token));
          if (!remove.length) continue;

          const patch = {
            fcmTokens: FieldValue.arrayRemove(...remove),
            pushUpdatedAt: FieldValue.serverTimestamp(),
          };
          if (typeof device.fcmToken === 'string' && remove.includes(device.fcmToken)) {
            patch.fcmToken = FieldValue.delete();
          }
          if (Array.isArray(device.devices)) {
            patch.devices = device.devices.filter(
              (entry) => entry && typeof entry.token === 'string' && !bad.has(entry.token)
            );
          }
          cleanups.push(db.collection('pushDevices').doc(uid).set(patch, { merge: true }));
        }
        await Promise.allSettled(cleanups);
        cleaned = bad.size;
      }
    }

    // Mark sent last, so a crash before this point retries rather than losing
    // the reminder silently.
    const sentBatch = db.batch();
    due.forEach((d) => sentBatch.update(d.ref, { sent: true, sentAt: FieldValue.serverTimestamp() }));
    await sentBatch.commit();

    return res.status(200).json({ processed, sent, cleaned });
  } catch (err) {
    console.error('[REMINDERS]', err);
    return res.status(500).json({ error: 'Reminder delivery failed' });
  }
}
