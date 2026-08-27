import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { useAuth } from '../context/AuthContext';
import { checkNotificationAllowed } from '../utils/notificationGate';
import type { AppNotification } from '../types';

const PUSH_SERVICE_WORKER_SCOPE = '/firebase-cloud-messaging-push-scope';

/**
 * Last-resort in-page notification, for the case where real push is NOT
 * working on this device.
 *
 * Two things were wrong with this before:
 *
 *  1. It ran even when push was active. The service worker shows a notification
 *     from the push, and this hook showed a SECOND one from the Firestore
 *     document, under the same tag. The page-created one has no click handler,
 *     so whichever landed last decided whether tapping the notification opened
 *     the right screen or did nothing at all. That is the likeliest reason a
 *     notification tap sometimes appeared to "do nothing".
 *  2. It mirrored category mutes but ignored quiet hours completely. The server
 *     correctly suppressed the push; this path then buzzed the user anyway.
 *
 * It now stands down whenever a push subscription exists, and applies the same
 * gate the server applies.
 */
export function useBrowserNotifications() {
  const { user, profile } = useAuth();
  const { notifications } = useNotifications(user?.uid);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  /** True when the service worker is already displaying pushes for us. */
  const pushActiveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
        const registration = await navigator.serviceWorker.getRegistration(PUSH_SERVICE_WORKER_SCOPE);
        const subscription = registration ? await registration.pushManager.getSubscription() : null;
        if (!cancelled) pushActiveRef.current = !!subscription;
      } catch {
        // Assume push is not active; showing one notification beats none.
      }
    })();

    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    if (!primedRef.current && notifications.length > 0) {
      notifications.forEach((n) => seenRef.current.add(n.id));
      primedRef.current = true;
      return;
    }
    if (!primedRef.current) { primedRef.current = true; return; }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    notifications.forEach((n: AppNotification) => {
      if (seenRef.current.has(n.id)) return;
      seenRef.current.add(n.id);
      if (n.read) return;
      if (document.visibilityState === 'visible') return;

      // The service worker is on duty; a second notification here would race it.
      if (pushActiveRef.current) return;

      const gate = checkNotificationAllowed(
        { notificationSettings: profile?.notificationSettings, timezone: profile?.timezone },
        n.type
      );
      if (!gate.allowed) return;

      try {
        const shown = new Notification(n.title, { body: n.body, icon: n.icon, tag: n.id });
        // Unlike the service worker's notification, this one needs its click
        // wiring done by hand -- without it, tapping did nothing at all.
        shown.onclick = () => {
          try {
            window.focus();
            if (n.route) window.location.assign(n.route);
          } finally {
            shown.close();
          }
        };
      } catch { /* ignore */ }
    });
  }, [notifications, profile]);
}
