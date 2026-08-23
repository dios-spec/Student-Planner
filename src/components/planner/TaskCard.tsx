import { useState } from 'react';
import { Check, MoreVertical, Pencil, Trash2, Star } from 'lucide-react';
import type { PlannerItem } from '../../types';
import SubjectPill from '../shared/SubjectPill';
import { daysLeftLabel } from '../../utils/date';

interface TaskCardProps {
  item: PlannerItem;
  done?: boolean;
  onToggleDone?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showCheckbox: boolean;
  important?: boolean;
  onToggleImportant?: () => void;
}

export default function TaskCard({ item, done, onToggleDone, onEdit, onDelete, showCheckbox, important, onToggleImportant }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`group relative rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition-opacity ${done ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        {showCheckbox && (
          <button
            onClick={onToggleDone}
            aria-label={done ? 'Mark as not done' : 'Mark as done'}
            aria-pressed={done}
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? 'border-success bg-success text-white animate-pop' : 'border-line text-transparent'}`}
          >
            <Check size={14} strokeWidth={3} />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <SubjectPill subjectId={item.subject} size="sm" />
            {important && <Star size={14} className="fill-amber-400 text-amber-400" aria-label="Pinned for you" />}
            {item.category === 'test' && item.dueDate && (
              <span className="rounded-full bg-coral-soft px-2 py-0.5 text-xs font-semibold text-coral">{daysLeftLabel(item.dueDate)}</span>
            )}
            {item.category === 'project' && item.dueDate && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{daysLeftLabel(item.dueDate)}</span>
            )}
          </div>
          <p className={`font-medium text-ink ${done ? 'line-through' : ''}`}>{item.title}</p>
          {item.description && <p className="mt-0.5 text-sm text-ink-soft">{item.description}</p>}
          {item.portion && <p className="mt-0.5 text-xs text-ink-soft">Portion: {item.portion}</p>}
          {item.note && <p className="mt-1 text-xs italic text-ink-soft">{item.note}</p>}
          {(item.updatedByName || item.createdByName) && (
            <p className="mt-1.5 text-[11px] text-ink-soft/70">{item.updatedByName ? `Updated by ${item.updatedByName}` : `Added by ${item.createdByName}`}</p>
          )}
        </div>

        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen((o) => !o)} aria-label="More options" className="rounded-full p-1.5 text-ink-soft hover:bg-surface-alt">
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                {onToggleImportant && (
                  <button onClick={() => { setMenuOpen(false); onToggleImportant(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-alt">
                    <Star size={15} className={important ? 'fill-amber-400 text-amber-400' : ''} /> {important ? 'Unpin for me' : 'Pin for me'}
                  </button>
                )}
                <button onClick={() => { setMenuOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-alt">
                  <Pencil size={15} /> Edit
                </button>
                <button onClick={() => { setMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-coral hover:bg-coral-soft">
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
