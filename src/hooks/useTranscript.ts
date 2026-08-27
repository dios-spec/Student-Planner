import { useCallback, useEffect, useState } from 'react';
import { mergeLive, mergeOlder, type TranscriptItem } from '../utils/transcript';

/**
 * Accumulates a chat transcript from a capped live snapshot plus older pages.
 *
 * IMPORTANT: this hook holds per-conversation state and deliberately has no
 * "reset" input. Callers that can switch between conversations must give the
 * owning component a React `key` (see MessagesPage), so switching remounts and
 * the transcript starts clean. A reset-on-prop-change effect would be wrong
 * here: the live snapshot lags the id by one render, so the old
 * conversation's messages would be merged in after the reset had run.
 */
export function useTranscript<T extends TranscriptItem>(live: T[] | null | undefined) {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    if (!live) return;
    setItems((prev) => mergeLive(prev, live));
  }, [live]);

  const prependOlder = useCallback((page: T[]) => {
    setItems((prev) => mergeOlder(prev, page));
  }, []);

  return { items, prependOlder };
}
