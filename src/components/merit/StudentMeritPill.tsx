import { useMeritRecords } from '../../hooks/useMeritRecords';

export default function StudentMeritPill({
  uid,
  size = 'small',
  variant = 'default',
}: {
  uid: string | undefined | null;
  size?: 'micro' | 'small';
  variant?: 'default' | 'dark';
}) {
  const { stats, loading, isTeacherProfile } = useMeritRecords(uid);

  if (!uid || loading || isTeacherProfile) return null;

  const shell = variant === 'dark'
    ? 'bg-black/35 text-white ring-1 ring-white/15'
    : 'border border-line bg-surface-alt text-ink-soft';
  const sizing = size === 'micro'
    ? 'gap-1 px-1.5 py-0.5 text-3xs'
    : 'gap-1.5 px-2 py-0.5 text-3xs';

  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center rounded-full font-semibold leading-none ${shell} ${sizing}`}
      aria-label={`Merit ${stats.merit}, Demerit ${stats.demerit}`}
      title={`Merit ${stats.merit} / Demerit ${stats.demerit}`}
    >
      <span className={variant === 'dark' ? 'text-emerald-200' : 'text-success'}>M {stats.merit}</span>
      <span aria-hidden="true" className={variant === 'dark' ? 'text-white/40' : 'text-ink-soft'}>/</span>
      <span className={variant === 'dark' ? 'text-rose-200' : 'text-coral'}>D {stats.demerit}</span>
    </span>
  );
}
