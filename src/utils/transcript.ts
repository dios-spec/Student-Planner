/**
 * Merging a live snapshot window with pages of older history.
 *
 * Both chat screens render "the last N messages" from a capped onSnapshot
 * window plus older pages fetched on demand. Concatenating the two arrays
 * (`[...older, ...live]`) loses messages: `older` is anchored once, but the
 * live window keeps sliding forward, so anything that falls out of the window
 * without having been fetched into `older` belongs to neither array and simply
 * vanishes from the transcript.
 *
 * Example with a 30-message window: load chat (61-90 live), tap "load earlier"
 * (31-60 into older), then 30 new messages arrive. Live is now 91-120, and
 * 61-90 are in neither array -- the reader sees 31-60 followed by 91-120 with
 * a silent 30-message gap.
 *
 * The fix is to accumulate everything ever seen and let the live window stay
 * authoritative only over its own time range.
 */

export interface TranscriptItem {
  id: string;
  createdAt?: { toMillis?: () => number } | null;
}

/** Pending serverTimestamp() writes sort last, as the newest thing. */
function timeOf(item: TranscriptItem): number {
  const ms = item.createdAt?.toMillis?.();
  return typeof ms === 'number' ? ms : Number.MAX_SAFE_INTEGER;
}

function sorted<T extends TranscriptItem>(items: T[]): T[] {
  return items.sort((a, b) => {
    const diff = timeOf(a) - timeOf(b);
    // Stable, deterministic order for identical timestamps.
    return diff !== 0 ? diff : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

/**
 * Fold a fresh live snapshot into the accumulated transcript.
 *
 * Within the live window the snapshot is the source of truth, so an item that
 * has disappeared from it (a hard delete performed in the Firebase console) is
 * dropped. Outside that window the archive is kept untouched -- that is the
 * whole point. Soft deletes keep the document, so they arrive as updates and
 * are simply overwritten.
 */
export function mergeLive<T extends TranscriptItem>(archive: readonly T[], live: readonly T[]): T[] {
  if (!live.length) return archive.slice();

  const liveIds = new Set(live.map((m) => m.id));
  const windowStart = Math.min(...live.map(timeOf));

  const merged: T[] = [];
  for (const item of archive) {
    if (liveIds.has(item.id)) continue;           // superseded by the live copy
    if (timeOf(item) >= windowStart) continue;    // inside the window but gone
    merged.push(item);
  }
  merged.push(...live);
  return sorted(merged);
}

/** Fold a page of older history in. Never prunes: the page predates the window. */
export function mergeOlder<T extends TranscriptItem>(archive: readonly T[], page: readonly T[]): T[] {
  if (!page.length) return archive.slice();
  const seen = new Set(archive.map((m) => m.id));
  return sorted([...archive, ...page.filter((m) => !seen.has(m.id))]);
}
