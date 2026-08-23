import Avatar from '../shared/Avatar';
import EmptyState from '../shared/EmptyState';
import { useLiveProfiles, liveAvatar, liveName } from '../../hooks/useLiveProfiles';
import type { MeritRecord } from '../../types';

function dateLabel(record: MeritRecord) {
  const date = record.createdAt?.toDate?.();
  if (!date) return 'Just now';
  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MeritHistory({ records }: { records: MeritRecord[] }) {
  const teacherProfiles = useLiveProfiles(records.map((record) => record.teacherId));

  if (records.length === 0) {
    return <EmptyState emoji={'\u{1F3C5}'} title="No Merit or Demerit yet" subtitle="New entries will appear here live." solid />;
  }

  return (
    <div className="space-y-2">
      {records.map((record) => {
        const teacherName = liveName(teacherProfiles, record.teacherId, 'Teacher');
        const teacherAvatar = liveAvatar(teacherProfiles, record.teacherId, undefined);
        const merit = record.kind === 'merit';

        return (
          <div key={record.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <Avatar name={teacherName} src={teacherAvatar} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-ink">{teacherName}</p>
                <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  merit ? 'bg-success-soft text-success' : 'bg-coral-soft text-coral'
                }`}>
                  {merit ? '+' : '-'}{record.points}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-ink">{record.reason}</p>
              <p className="mt-1 text-[11px] text-ink-soft">{dateLabel(record)} / {record.classId}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
