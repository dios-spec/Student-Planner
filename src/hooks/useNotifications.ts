import { useEffect, useState } from 'react';
import { watchNotifications, pruneOldNotifications } from '../firebase/notifications';
import type { AppNotification } from '../types';

export function useNotifications(uid: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) { setLoaded(false); return; }
    setLoaded(false);
    // BUG-11: background prune of old READ notifications, once per session.
    void pruneOldNotifications(uid);
    return watchNotifications(uid, (items) => {
      setNotifications(items);
      setLoaded(true);
    });
  }, [uid]);

  const unread = notifications.filter((n) => !n.read).length;
  return { notifications, unread, loaded };
}
