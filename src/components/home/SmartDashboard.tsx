import { useNavigate } from 'react-router-dom';
import { CheckCircle2, FlaskConical, CalendarClock, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActiveClass } from '../../context/ClassContext';
import { useHomeDashboard } from '../../hooks/useHomeDashboard';
import { useTimetable } from '../../hooks/useTimetable';
import { useConversations } from '../../hooks/useConversations';
import { daysLeftLabel, todayDayKey } from '../../utils/date';

const CATEGORY_LABEL: Record<string, string> = { test: 'Test', project: 'Project' };

export default function SmartDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeClass } = useActiveClass();
  const { upcomingTests, doneToday, totalToday, loading } = useHomeDashboard(activeClass, user?.uid);
  const { timetable } = useTimetable(activeClass);
  const { conversations } = useConversations(user?.uid);

  const dayKey = todayDayKey();
  const todayPeriods = (dayKey && timetable && timetable.days && timetable.days[dayKey] ? timetable.days[dayKey] : [])
    .slice()
    .sort((a, b) => a.period - b.period);

  const totalUnread = (conversations || []).reduce((sum, c) => sum + (c.unread?.[user?.uid || ''] ?? 0), 0);
  const hasAnything = totalToday > 0 || upcomingTests.length > 0 || todayPeriods.length > 0 || totalUnread > 0;

  if (loading || !hasAnything) return null;

  return (
    <div className="space-y-2.5 px-4 pt-4">
      {totalToday > 0 && (
        <button onClick={() => navigate('/planner')} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CheckCircle2 size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{doneToday} / {totalToday} tasks done today</span>
            <span className="block text-xs text-ink-soft">Tap to see today's planner</span>
          </span>
        </button>
      )}

      {totalUnread > 0 && (
        <button onClick={() => navigate('/messages')} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Mail size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{totalUnread} unread {totalUnread === 1 ? 'message' : 'messages'}</span>
            <span className="block text-xs text-ink-soft">Tap to open Chats</span>
          </span>
        </button>
      )}

      {todayPeriods.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <button onClick={() => navigate('/timetable')} className="mb-2 flex w-full items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <CalendarClock size={13} /> Today's timetable
            </span>
            <span className="text-xs font-medium text-accent">View all</span>
          </button>
          <div className="flex gap-2 overflow-x-auto">
            {todayPeriods.map((p) => (
              <div key={p.period} className="shrink-0 rounded-xl bg-surface-alt px-3 py-2 text-center">
                <p className="text-3xs font-bold text-ink-soft">P{p.period}</p>
                <p className="max-w-20 truncate text-xs font-semibold text-ink">{p.subject}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingTests.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Coming up</p>
          <div className="space-y-2">
            {upcomingTests.map((item) => (
              <button key={item.id} onClick={() => navigate('/upcoming')} className="flex w-full items-center gap-2.5 text-left">
                <FlaskConical size={16} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{CATEGORY_LABEL[item.category] || 'Item'}: {item.title}</span>
                <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold text-accent">{daysLeftLabel(item.dueDate || item.date)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
