import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
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
import { pushNotification, pushToMany } from './notifications';

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
return onSnapshot(
    doc(callsCol, callId),

    (snap) => {
cb(
        snap.exists()
          ? ({ id: snap.id, ...snap.data() } as CallDoc)
          : null
      );
    },

    (err) => {
      // A dead onSnapshot never fires again. Without cb(null) the caller can
      // never learn the call ended -> stuck call UI. BUG-04b.
      console.error('[CALL] watchCall ERROR:', callId, err);
      cb(null);
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

  const toMs = (call: CallDoc) => {
    const created = call.createdAt;

    if (typeof created?.toMillis === 'function') {
      return created.toMillis();
    }

    if (typeof created?.seconds === 'number') {
      return created.seconds * 1000;
    }

    return Date.now();
  };

  let latest: CallDoc[] = [];
  // Calls we have already timed out, so the ticker below cannot re-write the
  // same document every few seconds while the snapshot catches up.
  const expired = new Set<string>();

  const expire = (call: CallDoc) => {
    if (expired.has(call.id)) return;
    expired.add(call.id);

    void updateDoc(doc(callsCol, call.id), {
      status: 'missed',
      endedAt: serverTimestamp(),
    }).catch(() => {});

    // Only the caller announces the miss, so a group of callees cannot each
    // fan out a duplicate "missed call" notification.
    if (call.callerId === uid) {
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
  };

  const emit = () => {
    const now = Date.now();

    const calls = latest
      .filter((call) => {
        // Ringing/connecting calls should never live forever.
        if (call.status === 'ringing' || call.status === 'connecting') {
          const age = now - toMs(call);

          if (age > 45 * 1000) {
            // Previously ONLY the caller could write the timeout, and it was
            // only ever evaluated when Firestore pushed a new snapshot. If the
            // caller force-quit or lost network, no further snapshot arrived,
            // so the callee's phone rang forever and the document stayed
            // 'ringing' in Firestore permanently. Either side may now end it,
            // and a ticker re-runs this filter without needing a push.
            expire(call);
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

        // BUG-05: if I have a participant entry that is explicitly not-joined
        // I already left or declined -> never re-ring me for this same call.
        if (call.participants?.[uid] && call.participants[uid].joined === false) {
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
  };

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      latest = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CallDoc);
      emit();
    },
    (err) => {
      console.error('[CALL] watchIncomingCalls ERROR:', err);
      cb(null);
    }
  );

  const ticker = window.setInterval(emit, 5000);

  return () => {
    window.clearInterval(ticker);
    unsubscribe();
  };
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

/**
 * Tell the other members' devices that this call is no longer ringing.
 *
 * Delivered as a `callEnded` control push, which the service worker turns into
 * "close the notification tagged call-<id>" rather than a visible notification.
 * Firestore rules forbid notifying yourself, so this only reaches the OTHER
 * participants -- the local device closes its own via closeCallNotifications().
 */
export async function announceCallEnded(call: Pick<CallDoc, 'id' | 'memberIds' | 'conversationId'>, byUid: string) {
  const others = call.memberIds.filter((id) => id !== byUid);
  if (!others.length) return;

  await Promise.allSettled(
    others.map((userId) =>
      pushNotification(
        {
          userId,
          type: 'callEnded',
          title: 'Call ended',
          data: { callId: call.id, conversationId: call.conversationId },
        },
        byUid
      )
    )
  );
}

export async function endCall(callId: string) {
  await updateDoc(doc(callsCol, callId), { status: 'ended', endedAt: serverTimestamp() });
}

// ---- WebRTC signalling: one signals subcollection per ordered peer pair ----
export function signalDoc(callId: string, fromUid: string, toUid: string) {
  return doc(collection(db, 'calls', callId, 'signals'), `${fromUid}__${toUid}`);
}

/** Write the SDP half of the handshake (offer or answer). */
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

/**
 * Append ONE ICE candidate.
 *
 * This used to go through writeSignal() as `{ candidates: [oneCandidate] }`.
 * setDoc({ merge: true }) replaces an array field wholesale rather than
 * appending, so every candidate overwrote the previous one and the document
 * only ever held the most recent candidate. ICE candidates are emitted in
 * bursts of 5-10 within a few milliseconds and onSnapshot is not guaranteed to
 * deliver every intermediate state, so the candidate that actually mattered
 * (typically the relay candidate on mobile/NAT) was routinely dropped and the
 * call connected in name only, with no audio. arrayUnion appends atomically.
 */
export async function writeIceCandidate(
  callId: string,
  fromUid: string,
  toUid: string,
  candidate: RTCIceCandidateInit
) {
  await setDoc(signalDoc(callId, fromUid, toUid), {
    from: fromUid,
    to: toUid,
    candidates: arrayUnion(JSON.stringify(candidate)),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Remove both directions of a peer pair's signalling state.
 *
 * Signal docs were previously never deleted. On rejoin, watchSignal fired
 * immediately with the PREVIOUS session's SDP; the offerer accepted the stale
 * answer, set currentRemoteDescription, and then discarded the real answer via
 * its own `if (!pc.currentRemoteDescription)` guard. ICE credentials belonged
 * to the dead session, so the connection could never establish.
 */
export async function clearSignals(callId: string, uidA: string, uidB: string) {
  await Promise.allSettled([
    deleteDoc(signalDoc(callId, uidA, uidB)),
    deleteDoc(signalDoc(callId, uidB, uidA)),
  ]);
}

export function watchSignal(
  callId: string,
  fromUid: string,
  toUid: string,
  cb: (data: Record<string, unknown> | null) => void
) {
  return onSnapshot(
    signalDoc(callId, fromUid, toUid),
    (snap) => cb(snap.exists() ? (snap.data() as Record<string, unknown>) : null),
    (err) => {
      // A dead signalling listener means this peer can never negotiate. Say so
      // in the console instead of failing silently with a mute call.
      console.error('[CALL] watchSignal failed:', callId, fromUid, '->', toUid, err);
      cb(null);
    }
  );
}
