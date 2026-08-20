import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getAllActiveItemsOnce } from '../../firebase/planner';
import { subjectById } from '../../data/subjects';
import { CATEGORY_META } from '../../data/categories';
import { relativeDayLabel } from '../../utils/date';
import type { PlannerItem } from '../../types';
import EmptyState from './EmptyState';

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<PlannerItem[] | null>(null);

  useEffect(() => {
    if (open && all === null) {
      getAllActiveItemsOnce().then(setAll);
    }
  }, [open, all]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const results = q
    ? (all || []).filter((item) => {
        const subjectName = subjectById(item.subject).name.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          subjectName.includes(q) ||
          item.subject.toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 pt-[env(safe-area-inset-top)]">
        <Search size={18} className="text-ink-soft" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subjects, homework, tests…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft"
        />
        <button onClick={onClose} aria-label="Close search" className="rounded-full p-1.5 hover:bg-surface-alt">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-2 px-4 py-4">
        {q && results.length === 0 && <EmptyState emoji="🔍" title="No matches" subtitle={`Nothing found for "${query}"`} />}
        {results.map((item) => (
          <div key={item.id} className="rounded-2xl border border-line bg-surface p-3.5">
            <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
              <span>{CATEGORY_META[item.category].label}</span>
              <span>{relativeDayLabel(item.date)}</span>
            </div>
            <p className="text-sm font-medium text-ink">{item.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
