import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from './config';
import type { StudentProfile } from '../types';
import { randomStudentName } from '../utils/id';

const usersCol = collection(db, 'users');

export async function ensureUserProfile(uid: string): Promise<void> {
  const ref = doc(usersCol, uid);
  await setDoc(
    ref,
    {
      displayName: randomStudentName(),
      bio: '',
      emoji: '🙂',
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    },
    { merge: true } // merge so a repeat call never wipes an edited profile
  );
}

export function watchUserProfile(uid: string, cb: (p: StudentProfile | null) => void) {
  return onSnapshot(doc(usersCol, uid), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as StudentProfile) : null);
  });
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<Pick<StudentProfile, 'displayName' | 'bio' | 'emoji' | 'avatarUrl'>>
) {
  await updateDoc(doc(usersCol, uid), { ...patch });
}

export async function touchLastSeen(uid: string) {
  await updateDoc(doc(usersCol, uid), { lastSeen: serverTimestamp() }).catch(() => {});
}

export async function getAllProfilesOnce(): Promise<StudentProfile[]> {
  const snap = await getDocs(usersCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentProfile);
}
