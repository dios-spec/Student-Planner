import { useEffect, useState } from 'react';
import { watchMySaved } from '../firebase/saved';
import type { SavedItem, SavedItemType } from '../types';

export function useSavedItems(uid: string | undefined) {
  const [items, setItems] = useState<SavedItem[]>([]);
  useEffect(() => {
    if (!uid) { setItems([]); return; }
    return watchMySaved(uid, setItems);
  }, [uid]);

  function isSaved(type: SavedItemType, refId: string) {
    return items.some((i) => i.type === type && i.refId === refId);
  }

  return { items, isSaved };
}
