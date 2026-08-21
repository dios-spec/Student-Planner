import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { CallDoc, Conversation, StudentProfile } from '../types';

const callsCol = collection(db, 'calls');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

/** Start a call in a conversation. Returns the call id. */
export async function startCall(conversation: Conversation, caller: StudentProfile): Promise<string> {
  const participants: CallDoc['participants'] = {};
  conversation.memberIds.forEach((id) => {
    const info = conversation.members[id];
    participants[id] = stripUndefined({
      name: id === caller.id ? caller.displayName : info?.name || 'Student',
      avatar: id === caller.id ? caller.avatarUrl : info?.avatar,
      joined: id === caller.id, // caller is immediately in
      muted: false,
    });
  });

  const ref = await addDoc(callsCol, stripUndefined({
    conversationId: conversation.id,
    type: conversation.type,
    callerId: caller.id,
    callerName: caller.displayName,
    callerAvatar: caller.avatarUrl,
    groupName: conversation.type === 'group' ? conversation.name : undefined,
    groupPhoto: conversation.type === 'group' ? conversation.photoUrl : undefined,
    memberIds: conversation.memberIds,
    status: 'ringing',
    participants,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

export function watchCall(callId: string, cb: (c: CallDoc | null) => void) {
  return onSnapshot(doc(callsCol, callId), (snap) =>
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as CallDoc) : null)
  );
}

/** Watch for any active call this user is a member of (to show incoming-call UI). */
export function watchIncomingCalls(uid: string, cb: (call: CallDoc | null) => void) {
  const q = query(
    callsCol,
    where('memberIds', 'array-contains', uid),
    where('status', 'in', ['ringing', 'connecting', 'connected'])
  );
  return onSnapshot(q, (snap) => {
    const calls = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CallDoc);
    cb(calls[0] || null);
  });
}

export async function joinCall(callId: string, uid: string) {
  await updateDoc(doc(callsCol, callId), {
    [`participants.${uid}.joined`]: true,
    status: 'connected',
  });
}

export async function declineCall(callId: string, uid: string, isGroup: boolean) {
  if (isGroup) {
    // in a group, declining just marks you not-joined; call continues
    await updateDoc(doc(callsCol, callId), { [`participants.${uid}.joined`]: false });
  } else {
    await updateDoc(doc(callsCol, callId), { status: 'declined', endedAt: serverTimestamp() });
  }
}

export async function setMuted(callId: string, uid: string, muted: boolean) {
  await updateDoc(doc(callsCol, callId), { [`participants.${uid}.muted`]: muted });
}

/** Leave a call. If no one is left joined, end it. */
export async function leaveCall(callId: string, uid: string) {
  const snap = await getDoc(doc(callsCol, callId));
  if (!snap.exists()) return;
  const data = snap.data() as CallDoc;
  const stillJoined = Object.entries(data.participants).filter(
    ([id, p]) => id !== uid && p.joined
  ).length;
  if (stillJoined === 0) {
    await updateDoc(doc(callsCol, callId), { status: 'ended', endedAt: serverTimestamp(), [`participants.${uid}.joined`]: false });
  } else {
    await updateDoc(doc(callsCol, callId), { [`participants.${uid}.joined`]: false });
  }
}

export async function endCall(callId: string) {
  await updateDoc(doc(callsCol, callId), { status: 'ended', endedAt: serverTimestamp() });
}

// ---- WebRTC signalling: one signals subcollection per ordered peer pair ----
export function signalDoc(callId: string, fromUid: string, toUid: string) {
  return doc(collection(db, 'calls', callId, 'signals'), `${fromUid}__${toUid}`);
}

export async function writeSignal(
  callId: string,
  fromUid: string,
  toUid: string,
  payload: object
) {
  await setDoc(signalDoc(callId, fromUid, toUid), stripUndefined({
    from: fromUid,
    to: toUid,
    ...payload,
    updatedAt: serverTimestamp(),
  }), { merge: true });
}

export function watchSignal(
  callId: string,
  fromUid: string,
  toUid: string,
  cb: (data: Record<string, unknown> | null) => void
) {
  return onSnapshot(signalDoc(callId, fromUid, toUid), (snap) =>
    cb(snap.exists() ? (snap.data() as Record<string, unknown>) : null)
  );
}
