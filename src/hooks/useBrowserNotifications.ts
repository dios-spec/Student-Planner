import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { useAuth } from '../context/AuthContext';

/**
 * Fires a native browser notification when a new in-app notification arrives
 * AND the tab is hidden (backgrounded). When the tab is visible we rely on the
 * in-app bell/badge instead, to avoid double-notifying.
 *
 * Note: this only works while the browser/PWA is running in the background.
 * Waking a fully-closed browser (true push) needs FCM + a service worker and is
 * unreliable on iOS Safari — that's a platform limitation, not a bug.
 */
export function useBrowserNotifications() {
  const { user } = useAuth();
  const { notifications } = useNotifications(user?.uid);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    // Prime with existing notifications so we don't fire for history on first load.
    if (!primedRef.current && notifications.length > 0) {
      notifications.forEach((n) => seenRef.current.add(n.id));
      primedRef.current = true;
      return;
    }
    if (!primedRef.current) { primedRef.current = true; return; }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    notifications.forEach((n) => {
      if (seenRef.current.has(n.id)) return;
      seenRef.current.add(n.id);
      if (n.read) return;
      // only fire when tab is hidden
      if (document.visibilityState === 'visible') return;
      try {
        new Notification(n.title, { body: n.body, icon: n.icon, tag: n.id });
      } catch { /* ignore */ }
    });
  }, [notifications]);
}
