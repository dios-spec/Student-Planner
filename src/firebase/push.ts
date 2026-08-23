import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import {
  arrayUnion,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';

const PUSH_SERVICE_WORKER_SCOPE = '/firebase-cloud-messaging-push-scope';

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

    // Push tokens are device credentials, not profile data. Keep them in a
    // private owner-only document instead of the publicly readable user profile.
    await setDoc(
      doc(db, 'pushDevices', uid),
      {
        fcmToken: token,
        fcmTokens: arrayUnion(token),
        pushUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

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
