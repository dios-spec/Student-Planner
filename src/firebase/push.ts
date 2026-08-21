import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./config";

let messaging: ReturnType<typeof getMessaging> | null = null;

export async function initPush(uid: string): Promise<void> {
  if (!(await isSupported().catch(() => false))) return;
  if (typeof Notification === "undefined" || Notification.permission === "denied") return;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
    }
    messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) await updateDoc(doc(db, "users", uid), { fcmToken: token }).catch(() => {});
  } catch {
    // permission denied or unsupported -- in-app notifications still work regardless
  }
}

export function watchForegroundPush(cb: (title: string, body: string) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => cb(payload.notification?.title || "", payload.notification?.body || ""));
}
