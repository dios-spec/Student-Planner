import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  startCall as startCallSvc,
  watchIncomingCalls,
  watchCall,
  joinCall,
  declineCall,
  getCallOnce,
} from '../firebase/calls';
import CallScreen from '../components/call/CallScreen';
import IncomingCall from '../components/call/IncomingCall';
import type { CallDoc, Conversation, StudentProfile } from '../types';
import { primeRingtone } from '../utils/ringtone';

interface CallContextValue {
  startCall: (conversation: Conversation, caller: StudentProfile) => Promise<void>;
  inCall: boolean;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<CallDoc | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<CallDoc | null>(null);
  const [callMinimized, setCallMinimized] = useState(false);

  // Prime Web Audio on the first real gesture so later incoming calls can ring.
  useEffect(() => {
    const prime = () => primeRingtone();
    // click/touchend/keydown are the events Chrome's Web Audio autoplay
    // gate reliably recognizes as a completed gesture; pointerdown alone
    // (the very start of a tap, before the browser confirms intent) is not
    // always enough, which is what triggered the "AudioContext not allowed
    // to start" warning. Keeping pointerdown too costs nothing -- priming
    // is idempotent -- but click/touchend are the ones that actually count.
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('click', prime, { once: true });
    window.addEventListener('touchend', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('click', prime);
      window.removeEventListener('touchend', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  // Watch only genuine incoming calls.
  // Active calls are entered only by startCall() or accept(),
  // so refreshing cannot resurrect an old call.
  useEffect(() => {
    if (!user) return;

    return watchIncomingCalls(user.uid, (call) => {
      setIncoming(call);
    });
  }, [user]);

  // Handle Accept/Decline buttons from a system push notification.
  useEffect(() => {
    if (!user) return;

    const url = new URL(window.location.href);
    const action = url.searchParams.get('callAction');
    const callId = url.searchParams.get('callId');

    if (!callId || (action !== 'accept' && action !== 'decline')) return;

    let cancelled = false;

    (async () => {
      const call = await getCallOnce(callId);
      if (cancelled || !call || !call.memberIds.includes(user.uid)) return;

      if (action === 'accept') {
        await joinCall(callId, user.uid);
        if (!cancelled) {
          setActiveCallId(callId);
          setIncoming(null);
        }
      } else {
        await declineCall(callId, user.uid, call.type === 'group');
        if (!cancelled) setIncoming(null);
      }
    })()
      .catch((err) => console.warn('[CALL] push action failed', err))
      .finally(() => {
        const clean = new URL(window.location.href);
        clean.searchParams.delete('callAction');
        clean.searchParams.delete('callId');
        window.history.replaceState(
          {},
          '',
          clean.pathname + (clean.search ? clean.search : '') + clean.hash
        );
      });

    return () => { cancelled = true; };
  }, [user]);

  // Keep the active call fresh + auto-close when it ends.
  useEffect(() => {
    if (!activeCallId) { setActiveCall(null); return; }
    return watchCall(activeCallId, (c) => {
      setActiveCall(c);
      if (!c || c.status === 'ended' || c.status === 'declined' || c.status === 'missed' || c.status === 'unavailable') {
        setActiveCallId(null);
        setActiveCall(null);
        setCallMinimized(false);
      }
    });
  }, [activeCallId]);

  const startCall = useCallback(async (conversation: Conversation, caller: StudentProfile) => {
    if (!user) throw new Error('Cannot start call while signed out');
const createdCall = await startCallSvc(
      conversation,
      caller,
      user.uid
    );
// Open call UI immediately.
    // Firestore listener will replace this with the server version.
    setActiveCall(createdCall);
    setActiveCallId(createdCall.id);
    setCallMinimized(false);
  }, [user]);

  async function accept() {
    if (!incoming || !user) return;
    // BUG-23: if joinCall fails, keep the incoming screen up. Dismissing it
    // would hide the call while the caller is still ringing.
    try {
      await joinCall(incoming.id, user.uid);
    } catch (err) {
      console.error('[CALL] joinCall failed:', err);
      return;
    }
    setActiveCallId(incoming.id);
    setCallMinimized(false);
    setIncoming(null);
  }

  async function decline() {
    if (!incoming || !user) return;
    // Declining always dismisses locally -- a failed write must not trap the
    // user on a ringing screen they explicitly rejected.
    try {
      await declineCall(incoming.id, user.uid, incoming.type === 'group');
    } catch (err) {
      console.error('[CALL] declineCall failed:', err);
    } finally {
      setIncoming(null);
    }
  }

  return (
    <CallContext.Provider value={{ startCall, inCall: !!activeCall }}>
      {children}
      {activeCall && (
        <CallScreen
          call={activeCall}
          minimized={callMinimized}
          onMinimize={() => setCallMinimized(true)}
          onRestore={() => setCallMinimized(false)}
          onClose={() => {
            setActiveCallId(null);
            setCallMinimized(false);
          }}
        />
      )}
      {incoming && !activeCall && (
        <IncomingCall call={incoming} onAccept={accept} onDecline={decline} />
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
