import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import DateHeader from '../components/planner/DateHeader';
import TodaySummary from '../components/planner/TodaySummary';
import ImportantBanner from '../components/planner/ImportantBanner';
import AnnouncementsStrip from '../components/planner/AnnouncementsStrip';
import CategorySection from '../components/planner/CategorySection';
import AddTaskSheet from '../components/planner/AddTaskSheet';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SearchOverlay from '../components/shared/SearchOverlay';
import { PlannerSkeleton } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { usePlannerDay } from '../hooks/usePlannerDay';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { todayKey } from '../utils/date';
import { setCompletion, softDeletePlannerItem, restorePlannerItem } from '../firebase/planner';
import { CATEGORY_ORDER } from '../data/categories';
import type { PlannerItem } from '../types';

export default function PlannerPage() {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const [dateKey, setDateKey] = useState(todayKey());
  const { items, completions, loading } = usePlannerDay(dateKey, user?.uid);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlannerItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlannerItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const grouped = useMemo(() => {
    const map: Record<string, PlannerItem[]> = {};
    (items || []).forEach((i) => {
      map[i.category] = map[i.category] || [];
      map[i.category].push(i);
    });
    return map;
  }, [items]);

  function openAdd() {
    setEditingItem(null);
    setSheetOpen(true);
  }
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

  const hasAnything = (items || []).length > 0;

  return (
    <div className="pb-28">
      <TopBar
        title="Planner"
        right={
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="rounded-full p-2 text-ink-soft hover:bg-surface-alt"
          >
            <Search size={20} />
          </button>
        }
      />

      <div className="paper-texture space-y-5 px-4 pt-4">
        <DateHeader dateKey={dateKey} onChange={setDateKey} />

        {loading ? (
          <PlannerSkeleton />
        ) : (
          <>
            <AnnouncementsStrip />
            <ImportantBanner items={grouped.important || []} />
            <TodaySummary items={items || []} />

            {!hasAnything && (
              <EmptyState emoji="✅" title="All done!" subtitle="Nothing planned for this day yet." />
            )}

            {CATEGORY_ORDER.filter((c) => c !== 'important').map((cat) => (
              <CategorySection
                key={cat}
                category={cat}
                items={grouped[cat] || []}
                completions={completions}
                onToggleDone={(id, next) => user && setCompletion(user.uid, id, next)}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </>
        )}
      </div>

      <button
        onClick={openAdd}
        className="fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-lg active:scale-95 sm:bottom-8"
      >
        <Plus size={18} strokeWidth={2.5} />
        Add Task
      </button>

      <AddTaskSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        dateKey={dateKey}
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

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
