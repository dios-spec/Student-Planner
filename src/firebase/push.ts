import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './config';

let messaging: ReturnType<typeof getMessaging> | null = null;

export async function initPush(uid: string): Promise<void> {
  if (!(await isSupported().catch(() => false))) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    messaging = getMessaging();

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await updateDoc(doc(db, 'users', uid), {
        fcmToken: token,
        fcmTokens: arrayUnion(token),
        pushUpdatedAt: serverTimestamp(),
      }).catch(() => {});
      console.log('[PUSH] device registered');
    }
  } catch (err) {
    console.warn('[PUSH] registration failed', err);
  }
}

export function watchForegroundPush(
  cb: (title: string, body: string, data?: Record<string, string>) => void
) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const data = (payload.data || {}) as Record<string, string>;
    cb(
      payload.notification?.title || data.title || 'Student Planner',
      payload.notification?.body || data.body || '',
      data
    );
  });
}
