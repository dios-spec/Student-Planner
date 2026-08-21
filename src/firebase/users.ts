import {
  doc,
  getDoc,
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
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Profile already exists from a previous visit — leave it alone.
    // Re-sending createdAt here would fail the update rule, since it must
    // never change after creation.
    return;
  }
  await setDoc(ref, {
    displayName: randomStudentName(),
    bio: '',
    emoji: '🙂',
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  });
}

export function watchUserProfile(uid: string, cb: (p: StudentProfile | null) => void) {
  return onSnapshot(doc(usersCol, uid), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as StudentProfile) : null);
  });
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<
    Pick<
      StudentProfile,
      'displayName' | 'bio' | 'emoji' | 'avatarUrl' | 'classId' | 'moodEmoji' | 'moodLabel' | 'onboarded'
    >
  >
) {
  const clean: Record<string, unknown> = { ...patch };
  Object.keys(clean).forEach((key) => {
    if (clean[key] === undefined) delete clean[key];
  });
  await updateDoc(doc(usersCol, uid), clean);
}

export async function touchLastSeen(uid: string) {
  await updateDoc(doc(usersCol, uid), { lastSeen: serverTimestamp() }).catch(() => {});
}

export async function getAllProfilesOnce(): Promise<StudentProfile[]> {
  const snap = await getDocs(usersCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentProfile);
}

export async function getUserProfileOnce(uid: string): Promise<StudentProfile | null> {
  const snap = await getDoc(doc(usersCol, uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as StudentProfile) : null;
}
