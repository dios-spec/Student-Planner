import { subjectById } from '../../data/subjects';
import { appIcon } from './AppIcon';

export default function SubjectPill({ subjectId, size = 'md' }: { subjectId: string; size?: 'sm' | 'md' }) {
  const subject = subjectById(subjectId);
  const Icon = appIcon(subject.icon);
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
