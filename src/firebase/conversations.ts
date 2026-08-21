import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from './config';
import type { Conversation, StudentProfile } from '../types';

const convCol = collection(db, 'conversations');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

/** Deterministic id for a DM so the same pair always maps to one conversation. */
export function dmId(a: string, b: string): string {
  return [a, b].sort().join('__');
}

/** Get or create the 1:1 DM between two users. */
export async function ensureDM(me: StudentProfile, other: StudentProfile): Promise<string> {
  const id = dmId(me.id, other.id);
  const ref = doc(convCol, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, stripUndefined({
      type: 'dm',
      memberIds: [me.id, other.id],
      members: {
        [me.id]: { name: me.displayName, avatar: me.avatarUrl },
        [other.id]: { name: other.displayName, avatar: other.avatarUrl },
      },
      createdAt: serverTimestamp(),
      unread: { [me.id]: 0, [other.id]: 0 },
    }));
  }
  return id;
}

export interface NewGroup {
  name: string;
  photoUrl?: string;
  description?: string;
  classId?: string;
  creator: StudentProfile;
  memberProfiles: StudentProfile[]; // excluding creator is fine; we add creator below
}

export async function createGroup(g: NewGroup): Promise<string> {
  const all = [g.creator, ...g.memberProfiles.filter((m) => m.id !== g.creator.id)];
  const members: Record<string, { name: string; avatar?: string }> = {};
  const unread: Record<string, number> = {};
  all.forEach((m) => {
    members[m.id] = stripUndefined({ name: m.displayName, avatar: m.avatarUrl });
    unread[m.id] = 0;
  });
  const ref = await addDoc(convCol, stripUndefined({
    type: 'group',
    name: g.name,
    photoUrl: g.photoUrl,
    description: g.description,
    classId: g.classId,
    memberIds: all.map((m) => m.id),
    adminIds: [g.creator.id],
    members,
    createdBy: g.creator.id,
    createdAt: serverTimestamp(),
    unread,
  }));
  return ref.id;
}

/** Live list of the current user's conversations, most-recent first.
 *  Sorted client-side so we don't need a composite index (instant, no build wait)
 *  and so brand-new DMs with no messages yet still appear. */
export function watchMyConversations(uid: string, cb: (list: Conversation[]) => void) {
  const q = query(convCol, where('memberIds', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Conversation);
    list.sort((a, b) => {
      const at = a.lastAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const bt = b.lastAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return bt - at;
    });
    cb(list);
  });
}

export function watchConversation(id: string, cb: (c: Conversation | null) => void) {
  return onSnapshot(doc(convCol, id), (snap) =>
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Conversation) : null)
  );
}

export async function getConversationOnce(id: string): Promise<Conversation | null> {
  const snap = await getDoc(doc(convCol, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Conversation) : null;
}

/** Reset my unread counter when I open a conversation. */
export async function markConversationRead(id: string, uid: string) {
  await updateDoc(doc(convCol, id), { [`unread.${uid}`]: 0 }).catch(() => {});
}

// ---- Group management ----
export async function updateGroupInfo(
  id: string,
  patch: { name?: string; description?: string; photoUrl?: string }
) {
  await updateDoc(doc(convCol, id), stripUndefined(patch));
}

export async function addGroupMembers(id: string, profiles: StudentProfile[]) {
  const conv = await getConversationOnce(id);
  if (!conv) return;
  const batch = writeBatch(db);
  const ref = doc(convCol, id);
  profiles.forEach((p) => {
    batch.update(ref, {
      memberIds: arrayUnion(p.id),
      [`members.${p.id}`]: stripUndefined({ name: p.displayName, avatar: p.avatarUrl }),
      [`unread.${p.id}`]: 0,
    });
  });
  await batch.commit();
}

export async function removeGroupMember(id: string, memberId: string) {
  await updateDoc(doc(convCol, id), {
    memberIds: arrayRemove(memberId),
    adminIds: arrayRemove(memberId),
  });
}

export async function promoteToAdmin(id: string, memberId: string) {
  await updateDoc(doc(convCol, id), { adminIds: arrayUnion(memberId) });
}

export async function demoteAdmin(id: string, memberId: string) {
  await updateDoc(doc(convCol, id), { adminIds: arrayRemove(memberId) });
}

/** Leave a group. Caller must ensure another admin exists if they're the last one. */
export async function leaveGroup(id: string, uid: string) {
  await updateDoc(doc(convCol, id), {
    memberIds: arrayRemove(uid),
    adminIds: arrayRemove(uid),
  });
}

/** For member-picker: everyone except me (small class-sized dataset). */
export async function listAllProfiles(excludeUid: string): Promise<StudentProfile[]> {
  const snap = await getDocs(query(collection(db, 'users'), limit(200)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as StudentProfile)
    .filter((p) => p.id !== excludeUid && p.onboarded);
}

export { increment };
