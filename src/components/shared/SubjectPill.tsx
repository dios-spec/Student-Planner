import * as Icons from 'lucide-react';
import { subjectById } from '../../data/subjects';

export default function SubjectPill({ subjectId, size = 'md' }: { subjectId: string; size?: 'sm' | 'md' }) {
  const subject = subjectById(subjectId);
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[subject.icon] || Icons.BookMarked;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad}`}
      style={{ backgroundColor: `${subject.color}1A`, color: subject.color }}
    >
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.5} />
      {subject.name}
    </span>
  );
}
