import { useEffect, useState } from 'react';
import { watchNotifications } from '../firebase/notifications';
import type { AppNotification } from '../types';

export function useNotifications(uid: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) { setLoaded(false); return; }
    setLoaded(false);
    return watchNotifications(uid, (items) => {
      setNotifications(items);
      setLoaded(true);
    });
  }, [uid]);

  const unread = notifications.filter((n) => !n.read).length;
  return { notifications, unread, loaded };
}
