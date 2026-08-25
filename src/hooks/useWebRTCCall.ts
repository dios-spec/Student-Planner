import { useCallback, useEffect, useRef, useState } from 'react';
import { getIceServers } from '../firebase/iceConfig';
import { writeSignal, watchSignal, setMuted as setMutedRemote } from '../firebase/calls';
import type { CallDoc } from '../types';

/**
 * Manages the local mic stream and one RTCPeerConnection per other joined
 * participant (mesh). Signalling (SDP + ICE) is exchanged through Firestore.
 * Audio-only — no video tracks are ever added.
 *
 * Deterministic "polite/impolite" role by uid comparison decides who makes the
 * offer, avoiding glare in a mesh.
 */
export function useWebRTCCall(callId: string | null, myUid: string | null, call: CallDoc | null) {
  const [muted, setMutedState] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const speakerOnRef = useRef(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  // BUG-07: signal unsubscribes are tracked PER PEER so a departed peer can be
  // fully torn down (and therefore rejoin later) instead of leaking forever.
  const peerUnsubsRef = useRef<Map<string, () => void>>(new Map());
  const startedRef = useRef(false);

  const joinedPeers = call
    ? Object.entries(call.participants)
        .filter(([id, p]) => id !== myUid && p.joined)
        .map(([id]) => id)
    : [];

  // Acquire mic once when the call becomes active for us.
  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const makePeer = useCallback(
    async (otherUid: string) => {
      if (!callId || !myUid) return;
      if (pcsRef.current.has(otherUid)) return;

      const stream = await ensureLocalStream();
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcsRef.current.set(otherUid, pc);

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
          writeSignal(callId, myUid, otherUid, {
            candidates: [JSON.stringify(e.candidate)],
          });
        }
      };

      // The peer with the smaller uid creates the offer (deterministic).
      const iAmOfferer = myUid < otherUid;

      // Listen for the other side's signal doc addressed to me.
      const unsub = watchSignal(callId, otherUid, myUid, async (data) => {
        if (!data) return;
        try {
          if (data.sdp && data.sdpType) {
            const desc = new RTCSessionDescription({
              type: data.sdpType as RTCSdpType,
              sdp: data.sdp as string,
            });
            if (desc.type === 'offer' && !iAmOfferer) {
              await pc.setRemoteDescription(desc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await writeSignal(callId, myUid, otherUid, {
                sdp: answer.sdp,
                sdpType: answer.type,
              });
            } else if (desc.type === 'answer' && iAmOfferer) {
              if (!pc.currentRemoteDescription) await pc.setRemoteDescription(desc);
            }
          }
          if (Array.isArray(data.candidates)) {
            for (const c of data.candidates as string[]) {
              try { await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(c))); } catch { /* ignore */ }
            }
          }
        } catch { /* ignore signalling races */ }
      });
      peerUnsubsRef.current.set(otherUid, unsub);

      if (iAmOfferer) {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await writeSignal(callId, myUid, otherUid, { sdp: offer.sdp, sdpType: offer.type });
      }
    },
    [callId, myUid, ensureLocalStream]
  );

  // BUG-07: fully release a peer that left, so a later rejoin creates a fresh
  // connection instead of hitting the "already have a pc for this uid" guard.
  const dropPeer = useCallback((otherUid: string) => {
    const pc = pcsRef.current.get(otherUid);
    if (pc) { try { pc.close(); } catch { /* already closed */ } }
    pcsRef.current.delete(otherUid);

    const unsub = peerUnsubsRef.current.get(otherUid);
    if (unsub) { try { unsub(); } catch { /* ignore */ } }
    peerUnsubsRef.current.delete(otherUid);

    const el = audioElsRef.current.get(otherUid);
    if (el) { el.pause(); el.srcObject = null; el.remove(); }
    audioElsRef.current.delete(otherUid);
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

    joinedPeers.forEach((uid) => makePeer(uid));
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
    peerUnsubsRef.current.forEach((u) => { try { u(); } catch { /* ignore */ } });
    peerUnsubsRef.current.clear();
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
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

  return { muted, toggleMute, speakerOn, toggleSpeaker, ensureLocalStream, cleanup };
}
