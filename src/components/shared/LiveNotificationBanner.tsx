import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { markNotificationRead } from '../../firebase/notifications';
import type { AppNotification } from '../../types';

export default function LiveNotificationBanner() {
  const { user } = useAuth();
  const { notifications } = useNotifications(user?.uid);
  const navigate = useNavigate();
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const timer = useRef<number | null>(null);
  const [current, setCurrent] = useState<AppNotification | null>(null);

  useEffect(() => {
    if (!primed.current) {
      notifications.forEach((n) => seen.current.add(n.id));
      primed.current = true;
      return;
    }

    if (document.visibilityState !== 'visible') return;

    const next = notifications.find(
      (n) => !seen.current.has(n.id) && !n.read && n.type !== 'incomingCall'
    );
    notifications.forEach((n) => seen.current.add(n.id));

    if (!next) return;
    setCurrent(next);

    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCurrent(null), 5000);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notifications]);

  if (!current) return null;

  async function open() {
    await markNotificationRead(current!.id);
    const route = current!.route;
    setCurrent(null);
    if (route) navigate(route);
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[210] mx-auto max-w-md">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-2xl backdrop-blur">
        <button onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {current.icon ? (
            <img src={current.icon} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bell size={18} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{current.title}</span>
            {current.body && (
              <span className="block truncate text-xs text-ink-soft">{current.body}</span>
            )}
          </span>
        </button>
        <button onClick={() => setCurrent(null)} aria-label="Dismiss" className="rounded-full p-1.5 text-ink-soft">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
