import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types';

const CATEGORY_MAP: Record<string, string> = {
  dm: 'dm', groupMessage: 'groupMessage', classMessage: 'classMessage',
  reply: 'reply', comment: 'comment',
  postLike: 'postLike', reelLike: 'reelLike', storyLike: 'storyLike',
  incomingCall: 'calls', missedCall: 'missedCall',
  homework: 'homework', exam: 'exam', announcement: 'announcement',
  groupInvite: 'groupEvents', adminPromote: 'groupEvents', addedToGroup: 'groupEvents',
};

/** Fires a native browser notification when tab is hidden. Category muting
 * here is a best-effort client-side mirror of the server-side gate in
 * /api/send-push -- the server remains the source of truth for actual push. */
export function useBrowserNotifications() {
  const { user, profile } = useAuth();
  const { notifications } = useNotifications(user?.uid);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

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

      const category = CATEGORY_MAP[n.type];
      if (category && profile?.notificationSettings?.[category as keyof typeof profile.notificationSettings] === false) return;

      try {
        new Notification(n.title, { body: n.body, icon: n.icon, tag: n.id });
      } catch { /* ignore */ }
    });
  }, [notifications, profile]);
}
