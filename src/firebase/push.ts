import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './config';

let messaging: ReturnType<typeof getMessaging> | null = null;
const PUSH_SERVICE_WORKER_SCOPE = '/firebase-cloud-messaging-push-scope';

export async function initPush(uid: string): Promise<void> {
  const supported = await isSupported().catch(() => false);
  console.log('[PUSH] support=', supported);

  if (!supported) {
    console.warn('[PUSH] Firebase Messaging is not supported by this browser/device');
    return;
  }

  if (typeof Notification === 'undefined') {
    console.warn('[PUSH] Notification API unavailable');
    return;
  }

  console.log('[PUSH] permission=', Notification.permission);

  if (Notification.permission !== 'granted') {
    console.warn('[PUSH] permission is not granted');
    return;
  }

  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) throw new Error('VITE_FIREBASE_VAPID_KEY is missing');

    // Keep Firebase push on its own scope so it cannot replace the PWA's root service worker.
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: PUSH_SERVICE_WORKER_SCOPE,
    });
    await registration.update().catch(() => {});

    messaging = getMessaging();

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('[PUSH] FCM returned no registration token');
      return;
    }

    await updateDoc(doc(db, 'users', uid), {
      fcmToken: token,
      fcmTokens: arrayUnion(token),
      pushUpdatedAt: serverTimestamp(),
    });

    console.log('[PUSH] device registered', {
      uid,
      serviceWorkerScope: registration.scope,
      tokenLength: token.length,
    });
  } catch (err) {
    console.warn('[PUSH] registration failed', err);
  }
}
