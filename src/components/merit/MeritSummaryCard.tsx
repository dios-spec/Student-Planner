import { Award, Minus, Plus } from 'lucide-react';
import { useMeritRecords } from '../../hooks/useMeritRecords';

export default function MeritSummaryCard({
  uid,
  compact = false,
}: {
  uid: string;
  compact?: boolean;
}) {
  const { stats, badges, loading, isTeacherProfile } = useMeritRecords(uid);

  // Teachers manage student points but never have Merit/Demerit of their own.
  if (loading || isTeacherProfile) return null;

  return (
    <div className={`rounded-2xl border border-line bg-surface ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-2">
        <Award size={compact ? 16 : 18} className="text-accent" />
        <p className="text-sm font-semibold text-ink">Merit & Demerit</p>
        <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
          {stats.net >= 0 ? '+' : ''}{stats.net}
        </span>
      </div>

      <div className={`mt-3 grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
        <div className="rounded-xl bg-success-soft px-3 py-2">
          <p className="flex items-center gap-1 text-xs font-medium text-success"><Plus size={12} /> Merit</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{stats.merit}</p>
        </div>
        <div className="rounded-xl bg-coral-soft px-3 py-2">
          <p className="flex items-center gap-1 text-xs font-medium text-coral"><Minus size={12} /> Demerit</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{stats.demerit}</p>
        </div>
      </div>

      {badges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Earned badges">
          {badges.map((badge) => (
            <span
              key={badge.id}
              title={badge.description}
              className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-ink"
            >
              {badge.emoji} {badge.label}
            </span>
          ))}
        </div>
      ) : (
        !compact && <p className="mt-3 text-xs text-ink-soft">Badges appear automatically as merit points grow.</p>
      )}
    </div>
  );
}
