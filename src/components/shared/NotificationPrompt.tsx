import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function NotificationPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    const dismissed = localStorage.getItem('sbp_notif_prompt');
    if (dismissed || Notification.permission !== 'default') return;
    const t = setTimeout(() => setShow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted' && user) {
        const { initPush } = await import('../../firebase/push');
        await initPush(user.uid);
      }
    } finally {
      localStorage.setItem('sbp_notif_prompt', '1');
      setShow(false);
    }
  }

  function dismiss() {
    localStorage.setItem('sbp_notif_prompt', '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[190] mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-xl" role="status" aria-labelledby="notification-prompt-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Bell size={20} />
        </div>
        <div className="flex-1">
          <p id="notification-prompt-title" className="text-sm font-semibold text-ink">Never miss homework, messages or calls</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Get alerts for chats, class work, announcements and incoming calls.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={enable} className="min-h-11 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white">
              Enable Notifications
            </button>
            <button type="button" onClick={dismiss} className="min-h-11 rounded-full px-3 py-2 text-xs font-medium text-ink-soft">
              Not now
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss notification prompt" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
