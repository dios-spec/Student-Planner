import { useEffect, useState } from 'react';
import { watchMyNotes } from '../firebase/notes';
import type { PersonalNote } from '../types';

export function useMyNotes(uid: string | undefined) {
  const [notes, setNotes] = useState<PersonalNote[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchMyNotes(uid, setNotes);
  }, [uid]);

  return { notes, loading: notes === null };
}
