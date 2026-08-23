import { GraduationCap, ShieldCheck } from 'lucide-react';

export default function RoleBadge({ teacher, compact = false }: { teacher: boolean; compact?: boolean }) {
  const Icon = teacher ? ShieldCheck : GraduationCap;
  const label = teacher ? 'Verified teacher' : 'Student';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        teacher ? 'bg-success-soft text-success' : 'bg-surface-alt text-ink-soft'
      }`}
      aria-label={label}
      title={label}
    >
      <Icon size={12} aria-hidden="true" />
      {!compact && label}
    </span>
  );
}
