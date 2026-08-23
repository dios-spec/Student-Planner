import { useState } from 'react';
import { Megaphone, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { PlannerItem } from '../../types';
import PlannerAttachments from './PlannerAttachments';

interface ImportantBannerProps {
  items: PlannerItem[];
  onEdit: (item: PlannerItem) => void;
  onDelete: (item: PlannerItem) => void;
}

export default function ImportantBanner({ items, onEdit, onDelete }: ImportantBannerProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="relative flex items-start gap-3 rounded-2xl bg-coral-soft px-4 py-3">
          <Megaphone size={18} className="mt-0.5 shrink-0 text-coral" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-coral">{item.title}</p>
            {item.description && <p className="text-xs text-coral/80">{item.description}</p>}
            <PlannerAttachments attachments={item.attachments} compact />
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuFor((m) => (m === item.id ? null : item.id))}
              aria-label="More options"
              className="rounded-full p-1 text-coral/70 hover:bg-coral/10"
            >
              <MoreVertical size={16} />
            </button>
            {menuFor === item.id && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                <div className="absolute right-0 top-7 z-20 w-32 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                  <button
                    onClick={() => { setMenuFor(null); onEdit(item); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-alt"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => { setMenuFor(null); onDelete(item); }}
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
  );
}
