import * as Icons from 'lucide-react';
import type { PlannerItem } from '../../types';
import { CATEGORY_META } from '../../data/categories';
import TaskCard from './TaskCard';
import EmptyState from '../shared/EmptyState';

interface CategorySectionProps {
  category: PlannerItem['category'];
  items: PlannerItem[];
  completions: Record<string, boolean>;
  onToggleDone: (itemId: string, next: boolean) => void;
  onEdit: (item: PlannerItem) => void;
  onDelete: (item: PlannerItem) => void;
  emptyLabel?: string;
  importantSet?: Set<string>;
  onToggleImportant?: (itemId: string) => void;
}

export default function CategorySection({
  category, items, completions, onToggleDone, onEdit, onDelete, emptyLabel, importantSet, onToggleImportant,
}: CategorySectionProps) {
  const meta = CATEGORY_META[category];
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] || Icons.BookMarked;
  const showCheckbox = category === 'writing' || category === 'reading' || category === 'bring';

  if (items.length === 0 && !emptyLabel) return null;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon size={17} className="text-ink-soft" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">{meta.plural}</h3>
      </div>
      {items.length === 0 ? (
        <EmptyState emoji="🎉" title={emptyLabel || 'Nothing here'} solid />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <TaskCard
              key={item.id}
              item={item}
              done={completions[item.id]}
              onToggleDone={() => onToggleDone(item.id, !completions[item.id])}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              showCheckbox={showCheckbox}
              important={importantSet ? importantSet.has(item.id) : false}
              onToggleImportant={onToggleImportant ? () => onToggleImportant(item.id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
