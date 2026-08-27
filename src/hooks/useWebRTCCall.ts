import { useCallback, useEffect, useRef, useState } from 'react';
import { getIceServers } from '../firebase/iceConfig';
import {
  writeSignal,
  writeIceCandidate,
  watchSignal,
  clearSignals,
  setMuted as setMutedRemote,
} from '../firebase/calls';
import type { CallDoc } from '../types';

/**
 * Manages the local mic stream and one RTCPeerConnection per other joined
 * participant (mesh). Signalling (SDP + ICE) is exchanged through Firestore.
 * Audio-only — no video tracks are ever added.
 *
 * Deterministic "polite/impolite" role by uid comparison decides who makes the
 * offer, avoiding glare in a mesh.
 */

/** Why the microphone could not be used. Rendered by CallScreen. */
export type CallMediaError = 'denied' | 'unavailable' | 'failed' | null;

function classifyMediaError(err: unknown): Exclude<CallMediaError, null> {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name || '') : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'unavailable';
  return 'failed';
}

export function useWebRTCCall(callId: string | null, myUid: string | null, call: CallDoc | null) {
  const [muted, setMutedState] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [mediaError, setMediaError] = useState<CallMediaError>(null);
  const speakerOnRef = useRef(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  // BUG-07: signal unsubscribes are tracked PER PEER so a departed peer can be
  // fully torn down (and therefore rejoin later) instead of leaking forever.
  const peerUnsubsRef = useRef<Map<string, () => void>>(new Map());
  // Peers whose makePeer() is still awaiting getUserMedia. The old code checked
  // `pcsRef.has(uid)` BEFORE that await and only wrote the map entry after it,
  // so a second makePeer for the same uid (triggered by any participants change,
  // e.g. a mute toggle) sailed past the guard and built a duplicate connection.
  // The first one was then orphaned in the map and never closed.
  const pendingPeersRef = useRef<Set<string>>(new Set());
  // Remote SDP already applied per peer, so a re-delivered offer does not cause
  // a pointless renegotiation storm on a live connection.
  const appliedSdpRef = useRef<Map<string, string>>(new Map());
  // ICE candidates already added per peer (arrayUnion re-sends the whole list).
  const appliedCandidatesRef = useRef<Map<string, Set<string>>>(new Map());
  // Candidates that arrived before the remote description was set.
  const pendingCandidatesRef = useRef<Map<string, string[]>>(new Map());
  // cleanup() has [] deps so it can run exactly once on unmount; it reads the
  // current call identity through refs rather than closing over stale props.
  const callIdRef = useRef<string | null>(null);
  const myUidRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  callIdRef.current = callId;
  myUidRef.current = myUid;

  const joinedPeers = call
    ? Object.entries(call.participants)
        .filter(([id, p]) => id !== myUid && p.joined)
        .map(([id]) => id)
    : [];

  // Acquire mic once when the call becomes active for us.
  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('getUserMedia unavailable'), { name: 'NotFoundError' });
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  }, []);

  /** Add any candidates that arrived before the remote description existed. */
  const flushPendingCandidates = useCallback(async (otherUid: string, pc: RTCPeerConnection) => {
    const queued = pendingCandidatesRef.current.get(otherUid);
    if (!queued || !queued.length) return;
    pendingCandidatesRef.current.set(otherUid, []);
    for (const raw of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(raw)));
      } catch {
        /* a candidate that no longer applies is not fatal */
      }
    }
  }, []);

  const makePeer = useCallback(
    async (otherUid: string) => {
      if (!callId || !myUid) return;
      // Reserve the slot SYNCHRONOUSLY, before any await, so a concurrent call
      // for the same peer cannot slip through and create a second connection.
      if (pcsRef.current.has(otherUid) || pendingPeersRef.current.has(otherUid)) return;
      pendingPeersRef.current.add(otherUid);

      let stream: MediaStream;
      try {
        stream = await ensureLocalStream();
      } catch (err) {
        // Previously this rejected into a discarded promise: nothing was shown
        // and the call sat on "Connecting…" forever with no audio and no way
        // out except hanging up.
        pendingPeersRef.current.delete(otherUid);
        console.error('[CALL] microphone unavailable:', err);
        setMediaError(classifyMediaError(err));
        return;
      }

      // Relay credentials are short-lived and fetched from the server; the
      // helper caches them, so a mesh of peers costs one request, not N.
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pcsRef.current.set(otherUid, pc);
      pendingPeersRef.current.delete(otherUid);
      appliedCandidatesRef.current.set(otherUid, new Set());
      pendingCandidatesRef.current.set(otherUid, []);

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // remote audio sink
      pc.ontrack = (e) => {
        let el = audioElsRef.current.get(otherUid);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          el.muted = !speakerOnRef.current;
          el.setAttribute('playsinline', 'true');
          el.style.display = 'none';
          document.body.appendChild(el);
          audioElsRef.current.set(otherUid, el);
        }
        el.srcObject = e.streams[0];
        el.play().catch(() => {
          // Autoplay blocked once negotiation outlasts the original tap.
          // Retry on the next tap anywhere in the app — a guaranteed gesture.
          const retry = () => {
            el!.play().catch(() => {});
            document.removeEventListener('click', retry);
          };
          document.addEventListener('click', retry, { once: true });
        });
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void writeIceCandidate(callId, myUid, otherUid, e.candidate.toJSON()).catch((err) =>
            console.warn('[CALL] could not publish ICE candidate', err)
          );
        }
      };

      // A dead transport used to be invisible: the UI kept counting call time
      // with silence on both ends. Try an ICE restart before giving up.
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          console.warn('[CALL] peer connection failed, attempting ICE restart:', otherUid);
          try {
            pc.restartIce();
          } catch {
            /* not supported everywhere */
          }
        }
      };

      // The peer with the smaller uid creates the offer (deterministic).
      const iAmOfferer = myUid < otherUid;

      // Listen for the other side's signal doc addressed to me.
      const unsub = watchSignal(callId, otherUid, myUid, async (data) => {
        if (!data) return;
        try {
          if (data.sdp && data.sdpType) {
            const fingerprint = `${String(data.sdpType)}:${String(data.sdp)}`;
            // Re-applying an SDP we already handled renegotiated a live
            // connection once per incoming ICE candidate.
            if (appliedSdpRef.current.get(otherUid) !== fingerprint) {
              const desc = new RTCSessionDescription({
                type: data.sdpType as RTCSdpType,
                sdp: data.sdp as string,
              });
              if (desc.type === 'offer' && !iAmOfferer) {
                appliedSdpRef.current.set(otherUid, fingerprint);
                await pc.setRemoteDescription(desc);
                await flushPendingCandidates(otherUid, pc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await writeSignal(callId, myUid, otherUid, {
                  sdp: answer.sdp,
                  sdpType: answer.type,
                });
              } else if (desc.type === 'answer' && iAmOfferer) {
                if (pc.signalingState === 'have-local-offer') {
                  appliedSdpRef.current.set(otherUid, fingerprint);
                  await pc.setRemoteDescription(desc);
                  await flushPendingCandidates(otherUid, pc);
                }
              }
            }
          }
          if (Array.isArray(data.candidates)) {
            const applied = appliedCandidatesRef.current.get(otherUid) || new Set<string>();
            appliedCandidatesRef.current.set(otherUid, applied);
            for (const c of data.candidates as string[]) {
              if (applied.has(c)) continue;
              applied.add(c);
              if (!pc.remoteDescription) {
                // Cannot be added yet; replay once the answer/offer lands.
                pendingCandidatesRef.current.get(otherUid)?.push(c);
                continue;
              }
              try {
                await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(c)));
              } catch {
                /* ignore */
              }
            }
          }
        } catch {
          /* ignore signalling races */
        }
      });
      peerUnsubsRef.current.set(otherUid, unsub);

      if (iAmOfferer) {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await writeSignal(callId, myUid, otherUid, { sdp: offer.sdp, sdpType: offer.type });
      }
    },
    [callId, myUid, ensureLocalStream, flushPendingCandidates]
  );

  // BUG-07: fully release a peer that left, so a later rejoin creates a fresh
  // connection instead of hitting the "already have a pc for this uid" guard.
  const dropPeer = useCallback((otherUid: string) => {
    const pc = pcsRef.current.get(otherUid);
    if (pc) { try { pc.close(); } catch { /* already closed */ } }
    pcsRef.current.delete(otherUid);
    pendingPeersRef.current.delete(otherUid);

    const unsub = peerUnsubsRef.current.get(otherUid);
    if (unsub) { try { unsub(); } catch { /* ignore */ } }
    peerUnsubsRef.current.delete(otherUid);

    const el = audioElsRef.current.get(otherUid);
    if (el) { el.pause(); el.srcObject = null; el.remove(); }
    audioElsRef.current.delete(otherUid);

    appliedSdpRef.current.delete(otherUid);
    appliedCandidatesRef.current.delete(otherUid);
    pendingCandidatesRef.current.delete(otherUid);

    // Leave no stale SDP behind, or the next connection to this peer replays
    // the dead session's offer/answer and can never establish.
    const activeCallId = callIdRef.current;
    const me = myUidRef.current;
    if (activeCallId && me) {
      void clearSignals(activeCallId, me, otherUid).catch(() => {});
    }
  }, []);

  // Connect to every joined peer; runs when the participant set changes.
  useEffect(() => {
    if (!callId || !myUid || !call) return;
    const meJoined = call.participants[myUid]?.joined;
    if (!meJoined) return;
    if (!startedRef.current) startedRef.current = true;

    // Drop anyone we still hold a connection to who is no longer joined.
    const stillHere = new Set(joinedPeers);
    Array.from(pcsRef.current.keys()).forEach((uid) => {
      if (!stillHere.has(uid)) dropPeer(uid);
    });

    joinedPeers.forEach((uid) => {
      void makePeer(uid).catch((err) => {
        console.error('[CALL] could not connect to peer', uid, err);
        setMediaError((prev) => prev ?? 'failed');
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, myUid, call?.participants, JSON.stringify(joinedPeers)]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMutedState(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    if (callId && myUid) setMutedRemote(callId, myUid, next);
  }, [muted, callId, myUid]);

  const toggleSpeaker = useCallback(() => {
    const next = !speakerOnRef.current;
    speakerOnRef.current = next;
    setSpeakerOn(next);

    audioElsRef.current.forEach((el) => {
      el.muted = !next;

      // Turning speaker back on happens from a real user tap, so retry play()
      // immediately in case the browser had previously blocked autoplay.
      if (next) {
        void el.play().catch(() => {});
      }
    });
  }, []);

  const cleanup = useCallback(() => {
    const activeCallId = callIdRef.current;
    const me = myUidRef.current;

    peerUnsubsRef.current.forEach((u) => { try { u(); } catch { /* ignore */ } });
    peerUnsubsRef.current.clear();
    pcsRef.current.forEach((pc, otherUid) => {
      try { pc.close(); } catch { /* ignore */ }
      if (activeCallId && me) void clearSignals(activeCallId, me, otherUid).catch(() => {});
    });
    pcsRef.current.clear();
    pendingPeersRef.current.clear();
    appliedSdpRef.current.clear();
    appliedCandidatesRef.current.clear();
    pendingCandidatesRef.current.clear();
    audioElsRef.current.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    audioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    startedRef.current = false;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  return { muted, toggleMute, speakerOn, toggleSpeaker, mediaError, ensureLocalStream, cleanup };
}
