import { Pin, X } from 'lucide-react';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { deleteAnnouncement } from '../../firebase/announcements';
import { relativeDayLabel } from '../../utils/date';
import { useAuth } from '../../context/AuthContext';
import { useActiveClass } from '../../context/ClassContext';

export default function AnnouncementsStrip() {
  const { isTeacher } = useAuth();
  const { activeClass } = useActiveClass();
  const { announcements } = useAnnouncements(activeClass);
  const latest = (announcements || []).slice(0, 3);

  if (latest.length === 0) return null;

  return (
    <div className="space-y-2">
      {latest.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface-alt px-4 py-3">
          <Pin size={16} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {a.title} {a.forDate && <span className="font-normal text-ink-soft">· {relativeDayLabel(a.forDate)}</span>}
            </p>
            {a.body && <p className="text-xs text-ink-soft">{a.body}</p>}
            <p className="mt-0.5 text-[11px] text-ink-soft/70">by {a.createdByName}</p>
          </div>
          {isTeacher && (
            <button
              onClick={() => deleteAnnouncement(a.id)}
              aria-label="Delete announcement"
              className="shrink-0 rounded-full p-1 text-ink-soft hover:text-coral"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
