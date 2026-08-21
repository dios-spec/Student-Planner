import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  startCall as startCallSvc,
  watchIncomingCalls,
  watchCall,
  joinCall,
  declineCall,
} from '../firebase/calls';
import CallScreen from '../components/call/CallScreen';
import IncomingCall from '../components/call/IncomingCall';
import type { CallDoc, Conversation, StudentProfile } from '../types';

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

  // Watch for calls I'm a member of.
  useEffect(() => {
    if (!user) return;
    return watchIncomingCalls(user.uid, (call) => {
      if (!call) { setIncoming(null); return; }
      // if I'm already joined, it's my active call, not an incoming ring
      const meJoined = call.participants[user.uid]?.joined;
      if (meJoined) {
        setActiveCallId(call.id);
        setIncoming(null);
      } else if (call.status === 'ringing' || (call.type === 'group' && call.status === 'connected')) {
        // ring for DMs, and let me join ongoing group calls
        setIncoming(call);
      } else {
        setIncoming(null);
      }
    });
  }, [user]);

  // Keep the active call fresh + auto-close when it ends.
  useEffect(() => {
    if (!activeCallId) { setActiveCall(null); return; }
    return watchCall(activeCallId, (c) => {
      setActiveCall(c);
      if (!c || c.status === 'ended' || c.status === 'declined') {
        setActiveCallId(null);
        setActiveCall(null);
      }
    });
  }, [activeCallId]);

  const startCall = useCallback(async (conversation: Conversation, caller: StudentProfile) => {
    const id = await startCallSvc(conversation, caller);
    setActiveCallId(id);
  }, []);

  async function accept() {
    if (!incoming || !user) return;
    await joinCall(incoming.id, user.uid);
    setActiveCallId(incoming.id);
    setIncoming(null);
  }

  async function decline() {
    if (!incoming || !user) return;
    await declineCall(incoming.id, user.uid, incoming.type === 'group');
    setIncoming(null);
  }

  return (
    <CallContext.Provider value={{ startCall, inCall: !!activeCall }}>
      {children}
      {activeCall && (
        <CallScreen call={activeCall} onClose={() => setActiveCallId(null)} />
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
