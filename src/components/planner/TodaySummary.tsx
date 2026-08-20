import { BookMarked, PencilLine, ClipboardCheck, FolderKanban } from 'lucide-react';
import type { PlannerItem } from '../../types';

function Stat({ icon: Icon, count, label }: { icon: typeof BookMarked; count: number; label: string }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-surface-alt px-3 py-1.5 text-sm font-medium text-ink">
      <Icon size={16} className="text-accent" />
      {count} {label}
    </div>
  );
}

export default function TodaySummary({ items }: { items: PlannerItem[] }) {
  const counts = {
    writing: items.filter((i) => i.category === 'writing').length,
    reading: items.filter((i) => i.category === 'reading').length,
    test: items.filter((i) => i.category === 'test').length,
    project: items.filter((i) => i.category === 'project').length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Stat icon={PencilLine} count={counts.writing} label="Homework" />
      <Stat icon={BookMarked} count={counts.reading} label="Reading" />
      <Stat icon={ClipboardCheck} count={counts.test} label="Test" />
      <Stat icon={FolderKanban} count={counts.project} label="Project" />
    </div>
  );
}
