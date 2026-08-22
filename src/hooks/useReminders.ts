import { useEffect, useState } from 'react';
import { watchMyReminders } from '../firebase/reminders';
import type { Reminder } from '../types';

export function useReminders(uid: string | undefined) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  useEffect(() => {
    if (!uid) { setReminders([]); return; }
    return watchMyReminders(uid, setReminders);
  }, [uid]);
  return reminders;
}
