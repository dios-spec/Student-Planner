import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { PersonalNote } from '../types';

const col = collection(db, 'personalNotes');

// Private to the device/profile: Security Rules only allow ownerId == request.auth.uid to read.
export function watchMyNotes(uid: string, cb: (notes: PersonalNote[]) => void) {
  const q = query(col, where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PersonalNote));
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[NOTES] watchMyNotes failed:', err);
      cb([]);
    }
  );
}

export async function addNote(uid: string, text: string) {
  await addDoc(col, { ownerId: uid, text, done: false, createdAt: serverTimestamp() });
}

export async function toggleNote(id: string, done: boolean) {
  await updateDoc(doc(col, id), { done });
}

export async function deleteNote(id: string) {
  await deleteDoc(doc(col, id));
}
