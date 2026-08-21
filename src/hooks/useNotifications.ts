import { useEffect, useState } from 'react';
import { watchNotifications } from '../firebase/notifications';
import type { AppNotification } from '../types';

export function useNotifications(uid: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  useEffect(() => {
    if (!uid) return;
    return watchNotifications(uid, setNotifications);
  }, [uid]);
  const unread = notifications.filter((n) => !n.read).length;
  return { notifications, unread };
}
