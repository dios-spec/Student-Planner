import { Check } from 'lucide-react';
import type { Poll } from '../../types';

interface PollCardProps {
  poll: Poll;
  myUid: string;
  mine?: boolean;
  onVote: (optionId: string) => void;
  onClose?: () => void;
}

export default function PollCard({ poll, myUid, mine, onVote, onClose }: PollCardProps) {
  const totalVotes = new Set(poll.options.flatMap((o) => o.votes)).size;
  const isCreator = poll.createdBy === myUid;

  return (
    <div className={'mt-0.5 w-full min-w-[220px] rounded-xl border p-3 ' + (mine ? 'border-white/25 bg-white/10' : 'border-line bg-surface-alt')}>
      <p className={'mb-2 text-sm font-semibold ' + (mine ? 'text-white' : 'text-ink')}>{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const voted = opt.votes.includes(myUid);
          const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
          return (
            <button
              key={opt.id}
              onClick={() => !poll.closed && onVote(opt.id)}
              disabled={poll.closed}
              className={'relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs ' + (mine ? 'border-white/20' : 'border-line') + (poll.closed ? ' opacity-70' : '')}
            >
              <span
                className={'absolute inset-y-0 left-0 ' + (mine ? 'bg-white/20' : 'bg-accent-soft')}
                style={{ width: pct + '%' }}
              />
              <span className={'relative flex items-center justify-between gap-2 ' + (mine ? 'text-white' : 'text-ink')}>
                <span className="flex items-center gap-1.5">
                  {voted && <Check size={13} className={mine ? 'text-white' : 'text-accent'} />}
                  {opt.text}
                </span>
                <span className={mine ? 'text-white/70' : 'text-ink-soft'}>{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className={'text-[11px] ' + (mine ? 'text-white/60' : 'text-ink-soft')}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} {poll.closed ? '· Closed' : ''}
        </span>
        {isCreator && !poll.closed && onClose && (
          <button onClick={onClose} className={'text-[11px] font-medium ' + (mine ? 'text-white/80' : 'text-accent')}>
            Close poll
          </button>
        )}
      </div>
    </div>
  );
}
