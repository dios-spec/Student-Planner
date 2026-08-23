import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import Avatar from '../shared/Avatar';
import { useWebRTCCall } from '../../hooks/useWebRTCCall';
import { leaveCall } from '../../firebase/calls';
import { useAuth } from '../../context/AuthContext';
import { useLiveProfiles, liveName, liveAvatar } from '../../hooks/useLiveProfiles';
import { useLiveConversation } from '../../hooks/useLiveConversation';
import type { CallDoc } from '../../types';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallScreen({
  call,
  onClose,
}: {
  call: CallDoc;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { muted, toggleMute } = useWebRTCCall(call.id, user?.uid || null, call);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  const isGroup = call.type === 'group';
  const connected = call.status === 'connected';
  const otherId = call.memberIds.find((m) => m !== user?.uid) || '';
  const visibleProfileIds = isGroup
    ? Object.entries(call.participants).filter(([, p]) => p.joined).map(([id]) => id)
    : [otherId];
  const profiles = useLiveProfiles(visibleProfileIds);
  const conversation = useLiveConversation(call.conversationId);

  useEffect(() => {
    if (!connected) return;
    startRef.current = Date.now();
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [connected]);

  const joinedParticipants = Object.entries(call.participants).filter(([, p]) => p.joined);
  const other = call.participants[otherId];
  const title = isGroup
    ? conversation?.name || call.groupName || 'Group call'
    : liveName(profiles, otherId, other?.name || call.callerName);
  const photo = isGroup
    ? conversation?.photoUrl || call.groupPhoto
    : liveAvatar(profiles, otherId, other?.avatar);
  const ringingOrConnecting = call.status === 'ringing' || call.status === 'connecting';

  async function hangUp() {
    if (user) await leaveCall(call.id, user.uid, isGroup);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-gradient-to-b from-[#1a1d29] to-[#0e1016] px-6 py-12 pt-[calc(env(safe-area-inset-top)+3rem)]">
      <div className="flex flex-col items-center gap-4">
        <div className={`relative flex items-center justify-center ${isGroup ? '' : 'scale-150'}`}>
          {!connected && (
            <>
              <span className="call-ring" aria-hidden="true" />
              <span className="call-ring call-ring-delay" aria-hidden="true" />
            </>
          )}
          <div className={call.status === 'ringing' ? 'animate-call-avatar-pulse' : ''}>
            <Avatar name={title} src={photo} size="lg" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
          {connected ? (
            <p key="timer" className="animate-call-timer-in mt-1 text-sm text-white/60">{fmt(elapsed)}</p>
          ) : (
            <p className="mt-1 flex items-center justify-center gap-1 text-sm text-white/60">
              <span>{call.status === 'ringing' ? 'Calling' : call.status === 'connecting' ? 'Connecting' : call.status}</span>
              {ringingOrConnecting && (
                <span className="flex gap-0.5">
                  <span className="call-dot h-1 w-1 rounded-full bg-white/60" />
                  <span className="call-dot h-1 w-1 rounded-full bg-white/60" />
                  <span className="call-dot h-1 w-1 rounded-full bg-white/60" />
                </span>
              )}
            </p>
          )}
        </div>

        {isGroup && (
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {joinedParticipants.map(([id, p]) => {
              const participantName = liveName(profiles, id, p.name);
              const participantAvatar = liveAvatar(profiles, id, p.avatar);
              return (
                <div key={id} className="animate-call-participant-in flex flex-col items-center gap-1">
                  <div className="relative">
                    <Avatar name={participantName} src={participantAvatar} size="md" />
                    {p.muted && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-coral p-1 text-white">
                        <MicOff size={10} />
                      </span>
                    )}
                  </div>
                  <span className="max-w-16 truncate text-xs text-white/70">{participantName}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-5">
        <button
          onClick={toggleMute}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-200 ${muted ? 'bg-white text-ink' : 'bg-white/15 text-white'}`}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Speaker">
          <Volume2 size={22} />
        </button>

        <button onClick={hangUp} className="flex h-16 w-16 items-center justify-center rounded-full bg-coral text-white" aria-label="End call">
          <PhoneOff size={26} />
        </button>
      </div>
    </div>
  );
}


