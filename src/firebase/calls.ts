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
import { pushToMany } from './notifications';

const callsCol = collection(db, 'calls');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

/** Start a call in a conversation. Returns the call id. */
export async function startCall(
  conversation: Conversation,
  caller: StudentProfile,
  callerUid: string
): Promise<CallDoc> {
  console.log('[CALL] Firebase project:', db.app.options.projectId);

  const participants: CallDoc['participants'] = {};

  conversation.memberIds.forEach((id) => {
    const info = conversation.members[id];

    participants[id] = stripUndefined({
      name: id === callerUid ? caller.displayName : info?.name || 'Student',
      avatar: id === callerUid ? caller.avatarUrl : info?.avatar,
      joined: id === callerUid,
      muted: false,
    });
  });

  const payload = stripUndefined({
    conversationId: conversation.id,
    type: conversation.type,
    callerId: callerUid,
    callerName: caller.displayName,
    callerAvatar: caller.avatarUrl,
    groupName: conversation.type === 'group' ? conversation.name : undefined,
    groupPhoto: conversation.type === 'group' ? conversation.photoUrl : undefined,
    memberIds: conversation.memberIds,
    status: 'ringing',
    participants,
    createdAt: serverTimestamp(),
  });

  const ref = await addDoc(callsCol, payload);

  console.log('[CALL] Firestore addDoc resolved:', ref.id);

  void pushToMany(
    conversation.memberIds.filter((id) => id !== callerUid),
    {
      type: 'incomingCall',
      title: conversation.type === 'group' ? (conversation.name || 'Group call') : caller.displayName,
      body: conversation.type === 'group'
        ? `${caller.displayName} started a group voice call`
        : 'Incoming voice call',
      icon: conversation.type === 'group' ? conversation.photoUrl : caller.avatarUrl,
      route: `/messages?open=${conversation.id}`,
      data: {
        callId: ref.id,
        conversationId: conversation.id,
      },
    },
    callerUid
  ).catch((err) => console.warn('[CALL] incoming push failed', err));

  return {
    id: ref.id,
    ...payload,
  } as CallDoc;
}

export function watchCall(callId: string, cb: (c: CallDoc | null) => void) {
  console.log('[CALL] watchCall subscribing:', callId);

  return onSnapshot(
    doc(callsCol, callId),

    (snap) => {
      console.log(
        '[CALL] watchCall snapshot:',
        callId,
        'exists=',
        snap.exists(),
        snap.exists() ? snap.data()?.status : null
      );

      cb(
        snap.exists()
          ? ({ id: snap.id, ...snap.data() } as CallDoc)
          : null
      );
    },

    (err) => {
      console.error('[CALL] watchCall ERROR:', callId, err);
    }
  );
}

/** Watch for any active call this user is a member of (to show incoming-call UI). */
export function watchIncomingCalls(uid: string, cb: (call: CallDoc | null) => void) {
  const q = query(
    callsCol,
    where('memberIds', 'array-contains', uid),
    where('status', 'in', ['ringing', 'connecting', 'connected'])
  );

  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();

      const toMs = (call: CallDoc) => {
        const created = (call as any).createdAt;

        if (typeof created?.toMillis === 'function') {
          return created.toMillis();
        }

        if (typeof created?.seconds === 'number') {
          return created.seconds * 1000;
        }

        return now;
      };

      const calls = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as CallDoc)
        .filter((call) => {
          // Ringing/connecting calls should never live forever.
          if (call.status === 'ringing' || call.status === 'connecting') {
            const age = now - toMs(call);

            if (age > 45 * 1000) {
              if (call.callerId === uid) {
                void updateDoc(doc(callsCol, call.id), {
                  status: 'missed',
                  endedAt: serverTimestamp(),
                }).catch(() => {});

                void pushToMany(
                  call.memberIds.filter((id) => id !== call.callerId),
                  {
                    type: 'missedCall',
                    title: `Missed call from ${call.callerName}`,
                    body: call.type === 'group' ? (call.groupName || 'Group voice call') : 'Voice call',
                    icon: call.callerAvatar,
                    route: `/messages?open=${call.conversationId}`,
                    data: { callId: call.id, conversationId: call.conversationId },
                  },
                  uid
                ).catch(() => {});
              }

              return false;
            }
          }

          // My own outgoing call is controlled by local activeCallId.
          // Never rediscover it here after a refresh.
          if (call.callerId === uid) {
            return false;
          }

          // If I already joined this call, do not resurrect it after refresh.
          if (call.participants?.[uid]?.joined) {
            return false;
          }

          // Normal incoming DM call.
          if (call.status === 'ringing' || call.status === 'connecting') {
            return true;
          }

          // Allow a not-yet-joined member to join an ongoing group call.
          return call.type === 'group' && call.status === 'connected';
        })
        .sort((a, b) => toMs(b) - toMs(a));

      cb(calls[0] || null);
    },
    () => cb(null)
  );
}

export async function getCallOnce(callId: string): Promise<CallDoc | null> {
  try {
    const snap = await getDoc(doc(callsCol, callId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as CallDoc) : null;
  } catch {
    return null;
  }
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
export async function leaveCall(callId: string, uid: string, isGroup: boolean) {
  if (!isGroup) {
    // A DM only ever has two participants -- if either one leaves, the call
    // is over for both. The "someone else still joined, keep it alive" logic
    // below only makes sense for groups of 3+; applying it to DMs was the
    // exact bug where the other side's call screen never closed.
    await updateDoc(doc(callsCol, callId), {
      status: 'ended',
      endedAt: serverTimestamp(),
      [`participants.${uid}.joined`]: false,
    });
    return;
  }

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
