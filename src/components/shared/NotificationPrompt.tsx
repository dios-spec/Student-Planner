import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';

/** Friendly explanation shown once, then requests browser notification permission.
 *  Deferred (not shown the instant the app opens) per good-UX guidance. */
export default function NotificationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    const dismissed = localStorage.getItem('sbp_notif_prompt');
    if (dismissed || Notification.permission !== 'default') return;
    const t = setTimeout(() => setShow(true), 8000); // wait 8s before asking
    return () => clearTimeout(t);
  }, []);

  function enable() {
    Notification.requestPermission().finally(() => {
      localStorage.setItem('sbp_notif_prompt', '1');
      setShow(false);
    });
  }
  function dismiss() {
    localStorage.setItem('sbp_notif_prompt', '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[90] mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Bell size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">Never miss homework, messages or calls</p>
          <p className="mt-0.5 text-xs text-ink-soft">Get notified about new messages, upcoming work and incoming calls.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={enable} className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white">Enable Notifications</button>
            <button onClick={dismiss} className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft">Not now</button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-ink-soft"><X size={16} /></button>
      </div>
    </div>
  );
}
