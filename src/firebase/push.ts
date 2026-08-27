import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import {
  deleteField,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import { deviceLabel, nextDeviceState, type PushDeviceDoc } from '../utils/pushDevices';

const PUSH_SERVICE_WORKER_SCOPE = '/firebase-cloud-messaging-push-scope';

/**
 * Take any notification for this call off the lock screen.
 *
 * A ringing notification is shown with requireInteraction, so it stays until
 * it is tapped. Nothing ever closed it, which meant a declined, missed or
 * long-finished call left a live-looking "incoming call" sitting there. The
 * service worker tags every call notification `call-<callId>`, so it can be
 * found and closed by tag.
 *
 * This covers every device that currently has the app open. A device that is
 * closed is handled by the server: the caller sends a `callEnded` control push,
 * and a timeout replaces the ring with the missed-call notification, which
 * carries the same tag.
 */
export async function closeCallNotifications(callId: string): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const registration = await navigator.serviceWorker.getRegistration(PUSH_SERVICE_WORKER_SCOPE);
    if (!registration) return;
    const open = await registration.getNotifications({ tag: `call-${callId}` });
    open.forEach((n) => n.close());
  } catch {
    // Never let notification housekeeping break call teardown.
  }
}

export async function initPush(uid: string): Promise<void> {
  const supported = await isSupported().catch(() => false);

  if (!supported) {
    console.warn('[PUSH] Firebase Messaging is not supported by this browser/device');
    return;
  }

  if (typeof Notification === 'undefined') {
    console.warn('[PUSH] Notification API unavailable');
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) throw new Error('VITE_FIREBASE_VAPID_KEY is missing');

    // Keep Firebase push on its own scope so it cannot replace the PWA root worker.
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: PUSH_SERVICE_WORKER_SCOPE,
    });
    await registration.update().catch(() => {});

    const messaging = getMessaging();

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('[PUSH] FCM returned no registration token');
      return;
    }

    // Push tokens are device credentials, not profile data. They live in a
    // private owner-only document, never on the publicly readable profile.
    //
    // This used to be setDoc(arrayUnion(token)) on every app start. arrayUnion
    // only grows, the rules cap the array, and Chrome rotates tokens -- so the
    // array eventually hit the cap, every further write was rejected, and push
    // died permanently and silently. The list is now computed in full from the
    // current document: deduplicated, timestamped, pruned by age and bounded.
    const ref = doc(db, 'pushDevices', uid);
    const label = deviceLabel(typeof navigator !== 'undefined' ? navigator.userAgent : undefined);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.exists() ? (snap.data() as PushDeviceDoc) : null);
      const next = nextDeviceState(current, token, Date.now(), label);

      // Registration is idempotent: nothing changed, so do not burn a write on
      // every single app open.
      if (!next.changed) return;

      tx.set(
        ref,
        {
          fcmToken: next.fcmToken,
          fcmTokens: next.fcmTokens,
          devices: next.devices,
          pushUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    // Remove legacy public-profile token fields once the private copy is safe.
    await updateDoc(doc(db, 'users', uid), {
      fcmToken: deleteField(),
      fcmTokens: deleteField(),
      pushUpdatedAt: deleteField(),
    }).catch(() => {});
  } catch (err) {
    console.warn('[PUSH] registration failed', err);
  }
}
