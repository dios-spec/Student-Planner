import { useMemo } from 'react';
import TopBar from '../components/layout/TopBar';
import { useUpcoming } from '../hooks/useUpcoming';
import { relativeDayLabel } from '../utils/date';
import SubjectPill from '../components/shared/SubjectPill';
import EmptyState from '../components/shared/EmptyState';
import { PlannerSkeleton } from '../components/shared/Skeleton';
import { CATEGORY_META } from '../data/categories';
import { ClipboardCheck, FolderKanban } from 'lucide-react';

export default function UpcomingPage() {
  const { items, loading } = useUpcoming(21);

  const groupedByDate = useMemo(() => {
    const map: Record<string, typeof items> = {};
    (items || []).forEach((item) => {
      const key = item.dueDate && (item.category === 'test' || item.category === 'project') ? item.dueDate : item.date;
      map[key] = map[key] || [];
      map[key]!.push(item);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  return (
    <div className="pb-24">
      <TopBar title="Upcoming" />
      <div className="space-y-6 px-4 pt-4">
        {loading && <PlannerSkeleton />}

        {!loading && groupedByDate.length === 0 && (
          <EmptyState emoji="🎉" title="Nothing coming up" subtitle="Enjoy the free time!" />
        )}

        {groupedByDate.map(([date, dayItems]) => (
          <section key={date}>
            <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
              {relativeDayLabel(date)}
            </h3>
            <div className="space-y-2">
              {dayItems!
                .slice()
                .sort((a, b) => {
                  const priority = { important: 0, test: 1, project: 2, writing: 3, reading: 4, bring: 5 };
                  return priority[a.category] - priority[b.category];
                })
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                    {item.category === 'test' && <ClipboardCheck size={18} className="shrink-0 text-coral" />}
                    {item.category === 'project' && <FolderKanban size={18} className="shrink-0 text-accent" />}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-1.5">
                        <SubjectPill subjectId={item.subject} size="sm" />
                        <span className="text-xs text-ink-soft">{CATEGORY_META[item.category].label}</span>
                      </div>
                      <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
