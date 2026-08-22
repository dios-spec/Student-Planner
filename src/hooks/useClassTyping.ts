import { useEffect, useState } from 'react';
import { watchClassTyping } from '../firebase/typing';

export function useClassTyping(myUid: string | undefined) {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    if (!myUid) { setNames([]); return; }
    return watchClassTyping(myUid, setNames);
  }, [myUid]);
  return names;
}
