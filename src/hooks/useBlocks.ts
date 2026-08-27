import { useCallback, useEffect, useState } from 'react';
import { watchMyBlocks, watchBlockedByOthers } from '../firebase/blocks';
import { interactionStateFor, isBlockedPair, type InteractionState } from '../utils/blockPolicy';

export function useBlocks(uid: string | undefined) {
  const [iBlocked, setIBlocked] = useState<Set<string>>(new Set());
  const [blockedMe, setBlockedMe] = useState<Set<string>>(new Set());
  // Both listeners must have reported before any "not blocked" answer is
  // trustworthy. Previously the sets simply started empty and the hook
  // answered "not blocked" during that window, so the composer was live and a
  // blocked message was sendable for the first render(s) after mount.
  const [minePresent, setMinePresent] = useState(false);
  const [theirsPresent, setTheirsPresent] = useState(false);

  useEffect(() => {
    if (!uid) {
      setIBlocked(new Set());
      setBlockedMe(new Set());
      setMinePresent(false);
      setTheirsPresent(false);
      return;
    }

    setMinePresent(false);
    setTheirsPresent(false);

    const u1 = watchMyBlocks(uid, (next) => {
      setIBlocked(next);
      setMinePresent(true);
    });
    const u2 = watchBlockedByOthers(uid, (next) => {
      setBlockedMe(next);
      setTheirsPresent(true);
    });
    return () => { u1(); u2(); };
  }, [uid]);

  const loaded = !uid || (minePresent && theirsPresent);

  /** Definitive "blocked" answer. False while still loading -- prefer
   *  interactionState() at any call site that can render a pending state. */
  const cannotInteract = useCallback(
    (otherId: string) => loaded && isBlockedPair(otherId, iBlocked, blockedMe),
    [loaded, iBlocked, blockedMe]
  );

  /** Three-state answer: 'loading' | 'blocked' | 'open'. */
  const interactionState = useCallback(
    (otherId: string | null | undefined): InteractionState =>
      interactionStateFor(otherId, loaded, iBlocked, blockedMe),
    [loaded, iBlocked, blockedMe]
  );

  return { iBlocked, blockedMe, loaded, cannotInteract, interactionState };
}
