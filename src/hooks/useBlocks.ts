import { useEffect, useState } from 'react';
import { watchMyBlocks, watchBlockedByOthers } from '../firebase/blocks';

export function useBlocks(uid: string | undefined) {
  const [iBlocked, setIBlocked] = useState<Set<string>>(new Set());
  const [blockedMe, setBlockedMe] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const u1 = watchMyBlocks(uid, setIBlocked);
    const u2 = watchBlockedByOthers(uid, setBlockedMe);
    return () => { u1(); u2(); };
  }, [uid]);

  // can't interact if either side blocked the other
  const cannotInteract = (otherId: string) => iBlocked.has(otherId) || blockedMe.has(otherId);
  return { iBlocked, blockedMe, cannotInteract };
}
