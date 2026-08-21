import { watchMyNotes } from '../firebase/notes';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { PersonalNote } from '../types';

export function useMyNotes(uid: string | undefined) {
  const { data, loading } = useCachedSnapshot<PersonalNote[]>(
    uid ? `notes:${uid}` : 'notes:none',
    (cb) => (uid ? watchMyNotes(uid, cb) : () => {})
  );
  return { notes: data, loading };
}
