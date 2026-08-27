export const MAX_PINNED = 20;

export type PinOutcome = 'ok' | 'full';

/**
 * Minimal structural shape. Deliberately self-contained: this module is also
 * loaded by the node test runner under a nodenext tsconfig, so it must not
 * reach into the app's DOM-flavoured type graph.
 */
export interface PinnedLike {
  messageId: string;
}

export interface PinResult<T> {
  outcome: PinOutcome;
  /** null when nothing needs writing (already pinned, or the list is full). */
  next: T[] | null;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

/**
 * Pure pin/unpin list arithmetic, kept out of the Firestore layer so it can be
 * unit tested and so the transaction body stays trivial.
 */
export function applyPin<T extends PinnedLike>(
  current: readonly T[],
  entry: PinnedLike & Record<string, unknown>,
  pinnedAt: unknown
): PinResult<T> {
  if (current.some((p) => p.messageId === entry.messageId)) return { outcome: 'ok', next: null };
  if (current.length >= MAX_PINNED) return { outcome: 'full', next: null };
  return {
    outcome: 'ok',
    next: [...current, stripUndefined({ ...entry, pinnedAt }) as unknown as T],
  };
}

export function applyUnpin<T extends PinnedLike>(
  current: readonly T[],
  messageId: string
): T[] | null {
  const next = current.filter((p) => p.messageId !== messageId);
  return next.length === current.length ? null : next;
}
