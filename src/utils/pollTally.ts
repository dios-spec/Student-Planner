/**
 * Poll counting.
 *
 * Note on a claim worth recording: the percentage arithmetic here does NOT
 * overflow 100%. `voteOnPoll` (firebase/chat.ts) removes a uid before pushing
 * it, so a voter appears at most once in any single option, which means an
 * option's count can never exceed the number of distinct voters. Each bar also
 * lives in its own overflow-hidden row, so nothing spills out of a container.
 *
 * What WAS wrong is the wording. The denominator is distinct VOTERS, but the
 * footer rendered it as "N votes". In a multiple-choice poll three people
 * casting seven selections between them were reported as "3 votes", and the
 * per-option percentages legitimately sum past 100% with no indication of why.
 *
 * The clamp below is defensive only: a document hand-edited in the Firebase
 * console could contain a duplicated uid, and a >100% bar should not be the
 * way anyone finds out.
 */

export interface TallyOption {
  id: string;
  /** Distinct voters who chose this option. */
  count: number;
  /** Share of distinct voters, 0-100. */
  pct: number;
}

export interface PollTally {
  /** Distinct people who voted at all. */
  voters: number;
  /** Total selections cast; differs from `voters` only in multi-select polls. */
  selections: number;
  options: TallyOption[];
  /** Ready-to-render summary, correct for both poll kinds. */
  summary: string;
}

interface OptionLike { id: string; votes?: readonly string[] }

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function tallyPoll(
  options: readonly OptionLike[] | undefined,
  allowMultiple: boolean
): PollTally {
  const list = options || [];
  const distinctPerOption = list.map((o) => new Set(o.votes || []));
  const allVoters = new Set<string>();
  distinctPerOption.forEach((s) => s.forEach((uid) => allVoters.add(uid)));

  const voters = allVoters.size;
  const selections = distinctPerOption.reduce((n, s) => n + s.size, 0);

  const tallied = list.map((o, i) => {
    const count = distinctPerOption[i].size;
    return { id: o.id, count, pct: voters > 0 ? clampPct((count / voters) * 100) : 0 };
  });

  const noun = allowMultiple
    ? (voters === 1 ? 'voter' : 'voters')
    : (voters === 1 ? 'vote' : 'votes');

  return { voters, selections, options: tallied, summary: `${voters} ${noun}` };
}
