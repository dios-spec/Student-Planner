import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCheck, X, Bell } from 'lucide-react';
import Avatar from '../components/shared/Avatar';
import EmptyState from '../components/shared/EmptyState';
import { useNotifications } from '../hooks/useNotifications';
import { markNotificationRead, markAllRead, clearNotification } from '../firebase/notifications';
import { useAuth } from '../context/AuthContext';
import { useLiveProfiles, liveName, liveAvatar } from '../hooks/useLiveProfiles';
import { relativeTime } from '../utils/date';
import type { AppNotification } from '../types';

// Only these notification types have a PERSON's name as the title -- system
// notifications like "Class Chat" or "New test/exam" are not identities and
// should never be overridden by a live profile lookup.
const PERSON_TITLE_TYPES = new Set(['dm', 'reply', 'groupMessage', 'comment']);

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unread } = useNotifications(user?.uid);
  const profiles = useLiveProfiles(
    notifications.filter((n) => PERSON_TITLE_TYPES.has(n.type)).map((n) => n.fromUid)
  );

  function open(n: AppNotification) {
    markNotificationRead(n.id);
    if (n.route) navigate(n.route);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]">
        <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
          <ArrowLeft size={20} />
        </button>
        <p className="flex-1 font-display text-lg font-semibold text-ink">Notifications</p>
        {unread > 0 && user && (
          <button onClick={() => markAllRead(user.uid)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-accent">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 pt-8">
            <EmptyState emoji="🔔" title="No notifications" subtitle="You're all caught up!" />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {notifications.map((n) => {
              const isPerson = PERSON_TITLE_TYPES.has(n.type) && n.fromUid;
              const title = isPerson ? liveName(profiles, n.fromUid!, n.title) : n.title;
              const icon = isPerson ? liveAvatar(profiles, n.fromUid!, n.icon) : n.icon;
              return (
              <div
                key={n.id}
                className={`flex items-center gap-3 px-4 py-3 ${n.read ? '' : 'bg-accent-soft/40'}`}
              >
                <button onClick={() => open(n)} className="flex flex-1 items-center gap-3 text-left">
                  {icon ? (
                    <Avatar name={title} src={icon} size="md" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Bell size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{title}</p>
                    {n.body && <p className="truncate text-xs text-ink-soft">{n.body}</p>}
                    <p className="text-2xs text-ink-soft">
                      {n.createdAt?.toDate ? relativeTime(n.createdAt.toDate()) : ''}
                    </p>
                  </div>
                  {!n.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
                </button>
                <button onClick={() => clearNotification(n.id)} aria-label="Clear" className="shrink-0 rounded-full p-1.5 text-ink-soft hover:text-coral">
                  <X size={16} />
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
