import { useEffect, useState } from 'react';
import { watchClassPins } from '../firebase/pins';
import type { PinnedMessage } from '../types';

export function useClassPins() {
  const [pinned, setPinned] = useState<PinnedMessage[]>([]);
  useEffect(() => watchClassPins(setPinned), []);
  return pinned;
}
