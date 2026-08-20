import { Pin } from 'lucide-react';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { relativeDayLabel } from '../../utils/date';

export default function AnnouncementsStrip() {
  const { announcements } = useAnnouncements();
  const latest = (announcements || []).slice(0, 2);

  if (latest.length === 0) return null;

  return (
    <div className="space-y-2">
      {latest.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface-alt px-4 py-3">
          <Pin size={16} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {a.title} {a.forDate && <span className="font-normal text-ink-soft">· {relativeDayLabel(a.forDate)}</span>}
            </p>
            {a.body && <p className="text-xs text-ink-soft">{a.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
