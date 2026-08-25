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
import { pushNotification, pushToMany } from './notifications';

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

  // Try reading first — if the DM already exists we're done.
  // If it doesn't exist, Firestore's "only members can read" rule has no
  // memberIds to check and throws permission-denied. That's expected —
  // catch it and fall through to the create path, which IS allowed.
  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch {
    // permission-denied → doc doesn't exist yet, create it below
  }

  if (!exists) {
    await setDoc(ref, stripUndefined({
      type: 'dm',
      memberIds: [me.id, other.id],
      members: {
        [me.id]: stripUndefined({ name: me.displayName, avatar: me.avatarUrl }),
        [other.id]: stripUndefined({ name: other.displayName, avatar: other.avatarUrl }),
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

  void pushToMany(
    g.memberProfiles.map((p) => p.id),
    {
      type: 'groupInvite',
      title: `Added to ${g.name}`,
      body: `${g.creator.displayName} added you to a group`,
      icon: g.photoUrl,
      route: `/messages?open=${ref.id}`,
      data: { conversationId: ref.id },
    },
    g.creator.id
  ).catch(() => {});
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
  return onSnapshot(
    doc(convCol, id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Conversation) : null),
    () => cb(null) // permission-denied race (doc not visible yet) -- fail soft, don't crash the listener
  );
}

export async function getConversationOnce(id: string): Promise<Conversation | null> {
  try {
    const snap = await getDoc(doc(convCol, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Conversation) : null;
  } catch {
    return null; // permission-denied or non-existent
  }
}

/** Reset my unread counter when I open a conversation. */
export async function markConversationRead(id: string, uid: string) {
  await updateDoc(doc(convCol, id), {
    [`unread.${uid}`]: 0,
    [`lastReadAt.${uid}`]: serverTimestamp(),
  }).catch(() => {});
}

// ---- Group management ----
export async function updateGroupInfo(
  id: string,
  patch: { name?: string; description?: string; photoUrl?: string }
) {
  const conv = await getConversationOnce(id);
  await updateDoc(doc(convCol, id), stripUndefined(patch));

  if (conv) {
    void pushToMany(
      conv.memberIds,
      {
        type: 'groupInvite',
        title: patch.name ? `Group renamed to ${patch.name}` : `${conv.name || 'Group'} updated`,
        body: 'Group details were changed',
        icon: patch.photoUrl || conv.photoUrl,
        route: `/messages?open=${id}`,
        data: { conversationId: id },
      }
    ).catch(() => {});
  }
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

  void Promise.all(
    profiles.map((p) =>
      pushNotification({
        userId: p.id,
        type: 'addedToGroup',
        title: `Added to ${conv.name || 'a group'}`,
        body: 'You were added to a group chat',
        icon: conv.photoUrl,
        route: `/messages?open=${id}`,
        data: { conversationId: id },
      })
    )
  ).catch(() => {});
}

export async function removeGroupMember(id: string, memberId: string) {
  const conv = await getConversationOnce(id);

  await updateDoc(doc(convCol, id), {
    memberIds: arrayRemove(memberId),
    adminIds: arrayRemove(memberId),
  });

  if (conv) {
    void pushNotification({
      userId: memberId,
      type: 'groupInvite',
      title: `Removed from ${conv.name || 'group'}`,
      body: 'You were removed from the group chat',
      icon: conv.photoUrl,
      route: '/messages',
      data: { conversationId: id },
    }).catch(() => {});
  }
}

export async function promoteToAdmin(id: string, memberId: string) {
  const conv = await getConversationOnce(id);
  await updateDoc(doc(convCol, id), { adminIds: arrayUnion(memberId) });

  if (conv) {
    void pushNotification({
      userId: memberId,
      type: 'adminPromote',
      title: 'You are now an admin',
      body: `You were promoted in ${conv.name || 'a group'}`,
      icon: conv.photoUrl,
      route: `/messages?open=${id}`,
      data: { conversationId: id },
    }).catch(() => {});
  }
}

export async function demoteAdmin(id: string, memberId: string) {
  const conv = await getConversationOnce(id);
  // BUG-17: rules require adminIds.size() >= 1. Demoting the only admin was
  // rejected with no feedback -- fail loudly so the UI can explain it.
  if (conv && (conv.adminIds || []).length <= 1) {
    throw new Error('A group must keep at least one admin.');
  }
  await updateDoc(doc(convCol, id), { adminIds: arrayRemove(memberId) });

  if (conv) {
    void pushNotification({
      userId: memberId,
      type: 'adminPromote',
      title: 'Admin access removed',
      body: `You are no longer an admin in ${conv.name || 'the group'}`,
      icon: conv.photoUrl,
      route: `/messages?open=${id}`,
      data: { conversationId: id },
    }).catch(() => {});
  }
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
