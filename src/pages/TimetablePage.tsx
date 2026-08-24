import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useActiveClass } from '../context/ClassContext';
import { useTimetable } from '../hooks/useTimetable';
import { saveTimetable, DAY_KEYS } from '../firebase/timetable';
import AddPeriodSheet from '../components/timetable/AddPeriodSheet';
import ClassSelector from '../components/layout/ClassSelector';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import type { Timetable, TimetableDayKey, TimetablePeriod } from '../types';

const DAY_LABELS: Record<TimetableDayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
};

function todayKeyOf(): TimetableDayKey {
  const map: Record<number, TimetableDayKey> = {
    1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 0: 'mon',
  };
  return map[new Date().getDay()];
}

export default function TimetablePage() {
  const navigate = useNavigate();
  const { user, isTeacher } = useAuth();
  const { activeClass } = useActiveClass();
  const { timetable, loading } = useTimetable(activeClass);
  const [day, setDay] = useState<TimetableDayKey>(todayKeyOf());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<TimetablePeriod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimetablePeriod | null>(null);

  const emptyDays: Timetable['days'] = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] };
  const periods = (timetable?.days?.[day] || []).slice().sort((a, b) => a.period - b.period);

  async function upsertPeriod(period: TimetablePeriod) {
    if (!user || !isTeacher) return;
    const currentDays = timetable?.days || emptyDays;
    const dayList = (currentDays[day] || []).filter((p) => p.period !== period.period);
    dayList.push(period);
    await saveTimetable(activeClass, { ...currentDays, [day]: dayList }, user.uid);
  }

  async function removePeriod(period: TimetablePeriod) {
    if (!user || !isTeacher) return;
    const currentDays = timetable?.days || emptyDays;
    const dayList = (currentDays[day] || []).filter((p) => p.period !== period.period);
    await saveTimetable(activeClass, { ...currentDays, [day]: dayList }, user.uid);
  }

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/95 px-2 py-3 pt-[env(safe-area-inset-top)] backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
          <ArrowLeft size={20} />
        </button>
        <p className="font-display text-lg font-semibold text-ink">Timetable - {activeClass}</p>
      </header>

      <div className="px-4 pt-4">
        <ClassSelector />
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-4 pt-4">
        {DAY_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setDay(k)}
            className={(day === k ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft') + ' shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium'}
          >
            {DAY_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="space-y-2 px-4 pt-4">
        {!loading && periods.length === 0 && (
          <EmptyState
            emoji={'📅'}
            title="No periods yet"
            subtitle={isTeacher ? 'Tap + to add the first period for this day.' : 'No timetable has been added for this day yet.'}
          />
        )}

        {periods.map((p) => (
          <div key={p.period} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
              {p.period}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{p.subject}</p>
              {(p.teacher || p.room) && (
                <p className="truncate text-xs text-ink-soft">{[p.teacher, p.room].filter(Boolean).join(' / ')}</p>
              )}
            </div>

            {isTeacher && (
              <>
                <button
                  onClick={() => { setEditingPeriod(p); setSheetOpen(true); }}
                  aria-label="Edit period"
                  className="rounded-full p-1.5 text-ink-soft hover:text-accent"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  aria-label="Delete period"
                  className="rounded-full p-1.5 text-ink-soft hover:text-coral"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {isTeacher && (
        <>
          <button
            onClick={() => { setEditingPeriod(null); setSheetOpen(true); }}
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-lg active:scale-95 sm:bottom-8"
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Period
          </button>

          <AddPeriodSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            editingPeriod={editingPeriod}
            existingPeriodNumbers={periods.map((p) => p.period)}
            onSave={upsertPeriod}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            title="Delete period?"
            message="This period will be removed from the shared timetable."
            confirmLabel="Delete"
            danger
            onConfirm={() => { if (deleteTarget) removePeriod(deleteTarget); setDeleteTarget(null); }}
            onCancel={() => setDeleteTarget(null)}
          />
        </>
      )}
    </div>
  );
}
