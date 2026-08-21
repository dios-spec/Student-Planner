import { useMemo, useState } from 'react';
import { MoreVertical, Pencil, Trash2, ClipboardCheck, FolderKanban } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import { useUpcoming } from '../hooks/useUpcoming';
import { relativeDayLabel } from '../utils/date';
import SubjectPill from '../components/shared/SubjectPill';
import EmptyState from '../components/shared/EmptyState';
import { PlannerSkeleton } from '../components/shared/Skeleton';
import { CATEGORY_META } from '../data/categories';
import AddTaskSheet from '../components/planner/AddTaskSheet';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { softDeletePlannerItem, restorePlannerItem } from '../firebase/planner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { PlannerItem } from '../types';
import { useActiveClass } from '../context/ClassContext';
import ClassSelector from '../components/layout/ClassSelector';

export default function UpcomingPage() {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { activeClass } = useActiveClass();
  const { items, loading } = useUpcoming(activeClass, 21);
  const [editingItem, setEditingItem] = useState<PlannerItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlannerItem | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const groupedByDate = useMemo(() => {
    const map: Record<string, PlannerItem[]> = {};
    (items || []).forEach((item) => {
      const key = item.dueDate && (item.category === 'test' || item.category === 'project') ? item.dueDate : item.date;
      map[key] = map[key] || [];
      map[key]!.push(item);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  function openEdit(item: PlannerItem) {
    setEditingItem(item);
    setSheetOpen(true);
  }
  async function confirmDelete() {
    if (!deleteTarget || !user || !profile) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await softDeletePlannerItem(target.id, user.uid, profile.displayName);
    show('Task deleted', {
      label: 'Undo',
      onClick: () => restorePlannerItem(target.id, user.uid, profile.displayName),
    });
  }

  return (
    <div className="pb-24">
      <TopBar title="Upcoming" />
      <div className="space-y-6 px-4 pt-4">
        <ClassSelector />
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
              {dayItems
                .slice()
                .sort((a, b) => {
                  const priority = { important: 0, test: 1, project: 2, writing: 3, reading: 4, bring: 5 };
                  return priority[a.category] - priority[b.category];
                })
                .map((item) => (
                  <div key={item.id} className="relative flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                    {item.category === 'test' && <ClipboardCheck size={18} className="shrink-0 text-coral" />}
                    {item.category === 'project' && <FolderKanban size={18} className="shrink-0 text-accent" />}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-1.5">
                        <SubjectPill subjectId={item.subject} size="sm" />
                        <span className="text-xs text-ink-soft">{CATEGORY_META[item.category].label}</span>
                      </div>
                      <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        onClick={() => setMenuFor((m) => (m === item.id ? null : item.id))}
                        aria-label="More options"
                        className="rounded-full p-1.5 text-ink-soft hover:bg-surface-alt"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {menuFor === item.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                          <div className="absolute right-0 top-8 z-20 w-32 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                            <button
                              onClick={() => { setMenuFor(null); openEdit(item); }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-alt"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              onClick={() => { setMenuFor(null); setDeleteTarget(item); }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-coral hover:bg-coral-soft"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>

      <AddTaskSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        dateKey={editingItem?.date || ''}
        editingItem={editingItem}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete task?"
        message={`"${deleteTarget?.title}" will be removed for everyone. You can undo right after.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
