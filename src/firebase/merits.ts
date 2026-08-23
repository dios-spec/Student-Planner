import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { MeritKind, MeritRecord, StudentProfile } from '../types';

const meritCol = collection(db, 'meritRecords');
const usersCol = collection(db, 'users');

export interface MeritStats {
  merit: number;
  demerit: number;
  net: number;
  meritAwards: number;
  demeritAwards: number;
}

export interface MeritBadge {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

export const MERIT_BADGES: Array<MeritBadge & { minMerit: number }> = [
  { id: 'first-merit', emoji: '\u2B50', label: 'First Merit', description: 'Earned the first merit point.', minMerit: 1 },
  { id: 'rising-star', emoji: '\u{1F31F}', label: 'Rising Star', description: 'Reached 5 merit points.', minMerit: 5 },
  { id: 'great-effort', emoji: '\u{1F3C5}', label: 'Great Effort', description: 'Reached 10 merit points.', minMerit: 10 },
  { id: 'role-model', emoji: '\u{1F3C6}', label: 'Role Model', description: 'Reached 25 merit points.', minMerit: 25 },
  { id: 'merit-champion', emoji: '\u{1F451}', label: 'Merit Champion', description: 'Reached 50 merit points.', minMerit: 50 },
];

function byNewest(a: MeritRecord, b: MeritRecord) {
  const aMs = a.createdAt?.toMillis?.() ?? 0;
  const bMs = b.createdAt?.toMillis?.() ?? 0;
  return bMs - aMs;
}

/**
 * Live source of truth for one student's Merit/Demerit history.
 * Manual edits made in Firestore Console also arrive here immediately.
 */
export function watchMeritRecords(studentId: string, cb: (records: MeritRecord[]) => void) {
  const q = query(meritCol, where('studentId', '==', studentId));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as MeritRecord)
        .sort(byNewest)
    );
  });
}

/** Teacher dashboard listener. Kept live so manual Firestore corrections appear immediately. */
export function watchAllMeritRecords(cb: (records: MeritRecord[]) => void) {
  return onSnapshot(meritCol, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as MeritRecord)
        .sort(byNewest)
    );
  });
}

/**
 * Live profile roster. Merit records intentionally store UIDs instead of copied
 * names/avatars, so changing a profile updates old and new Merit UI alike.
 */
export function watchMeritProfiles(cb: (profiles: StudentProfile[]) => void) {
  return onSnapshot(usersCol, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentProfile));
  });
}

export async function addMeritRecord(input: {
  studentId: string;
  teacherId: string;
  classId: string;
  kind: MeritKind;
  points: number;
  reason: string;
}) {
  const points = Math.max(1, Math.min(10, Math.round(input.points)));
  const reason = input.reason.trim().slice(0, 160);
  if (!reason) throw new Error('Reason is required.');

  await addDoc(meritCol, {
    studentId: input.studentId,
    teacherId: input.teacherId,
    classId: input.classId,
    kind: input.kind,
    points,
    reason,
    createdAt: serverTimestamp(),
  });
}

export function calculateMeritStats(records: MeritRecord[]): MeritStats {
  let merit = 0;
  let demerit = 0;
  let meritAwards = 0;
  let demeritAwards = 0;

  for (const record of records) {
    const points = Number.isFinite(record.points) ? Math.max(0, record.points) : 0;
    if (record.kind === 'merit') {
      merit += points;
      meritAwards += 1;
    } else if (record.kind === 'demerit') {
      demerit += points;
      demeritAwards += 1;
    }
  }

  return {
    merit,
    demerit,
    net: merit - demerit,
    meritAwards,
    demeritAwards,
  };
}

export function earnedMeritBadges(records: MeritRecord[]): MeritBadge[] {
  const stats = calculateMeritStats(records);
  return MERIT_BADGES
    .filter((badge) => stats.merit >= badge.minMerit)
    .map(({ minMerit: _minMerit, ...badge }) => badge);
}
