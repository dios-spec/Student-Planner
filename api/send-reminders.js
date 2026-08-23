import { adminApp, asStrings } from './_lib/firebaseAdmin.js';
import { isWithinQuietHours } from './_lib/notificationGate.js';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

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

    let processed = 0;

    for (const docSnap of dueSnap.docs) {
      const r = docSnap.data();
      try {
        const userSnap = await db.collection('users').doc(r.userId).get();
        const user = userSnap.exists ? userSnap.data() : null;
        const pushDeviceSnap = await db.collection('pushDevices').doc(r.userId).get();
        const pushDevice = pushDeviceSnap.exists ? (pushDeviceSnap.data() || {}) : {};
        const tokens = []
          .concat(Array.isArray(pushDevice && pushDevice.fcmTokens) ? pushDevice.fcmTokens : [])
          .concat(typeof (pushDevice && pushDevice.fcmToken) === 'string' ? [pushDevice.fcmToken] : [])
          .concat(Array.isArray(user && user.fcmTokens) ? user.fcmTokens : [])
          .concat(typeof (user && user.fcmToken) === 'string' ? [user.fcmToken] : [])
          .filter((v, i, a) => typeof v === 'string' && v && a.indexOf(v) === i);

        await db.collection('notifications').add({
          userId: r.userId,
          type: 'reminder',
          title: 'Reminder',
          body: r.itemTitle || 'You asked to be reminded about this',
          route: '/planner',
          fromUid: r.userId,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        const qh = user && user.notificationSettings && user.notificationSettings.quietHours;
        const quiet = qh && qh.enabled && isWithinQuietHours(new Date(), user.timezone, qh.start, qh.end) && !qh.allowUrgent;

        if (tokens.length && !quiet) {
          const data = asStrings({
            type: 'reminder',
            title: 'Reminder',
            body: r.itemTitle || 'You asked to be reminded about this',
            route: '/planner',
          });
          await getMessaging().sendEachForMulticast({ tokens, data });
        }

        await docSnap.ref.update({ sent: true, sentAt: FieldValue.serverTimestamp() });
        processed++;
      } catch (innerErr) {
        console.error('[REMINDERS] failed for', docSnap.id, innerErr);
      }
    }

    return res.status(200).json({ processed });
  } catch (err) {
    console.error('[REMINDERS]', err);
    return res.status(500).json({ error: 'Reminder delivery failed' });
  }
}
