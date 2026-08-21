import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import Avatar from '../shared/Avatar';
import { useWebRTCCall } from '../../hooks/useWebRTCCall';
import { leaveCall } from '../../firebase/calls';
import { useAuth } from '../../context/AuthContext';
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

  useEffect(() => {
    if (!connected) return;
    startRef.current = Date.now();
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [connected]);

  const joinedParticipants = Object.entries(call.participants).filter(([, p]) => p.joined);
  const title = isGroup ? call.groupName || 'Group call' : call.participants[call.memberIds.find((m) => m !== user?.uid) || '']?.name || call.callerName;
  const photo = isGroup ? call.groupPhoto : call.participants[call.memberIds.find((m) => m !== user?.uid) || '']?.avatar;

  const statusLabel =
    call.status === 'ringing' ? 'Calling…'
    : call.status === 'connecting' ? 'Connecting…'
    : connected ? fmt(elapsed)
    : call.status;

  async function hangUp() {
    if (user) await leaveCall(call.id, user.uid);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-gradient-to-b from-[#1a1d29] to-[#0e1016] px-6 py-12 pt-[calc(env(safe-area-inset-top)+3rem)]">
      <div className="flex flex-col items-center gap-4">
        {isGroup ? (
          <Avatar name={title} src={photo} size="lg" />
        ) : (
          <div className="scale-150"><Avatar name={title} src={photo} size="lg" /></div>
        )}
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-white/60">{statusLabel}</p>
        </div>

        {isGroup && (
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {joinedParticipants.map(([id, p]) => (
              <div key={id} className="flex flex-col items-center gap-1">
                <div className="relative">
                  <Avatar name={p.name} src={p.avatar} size="md" />
                  {p.muted && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-coral p-1 text-white">
                      <MicOff size={10} />
                    </span>
                  )}
                </div>
                <span className="max-w-16 truncate text-xs text-white/70">{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-5">
        <button
          onClick={toggleMute}
          className={`flex h-14 w-14 items-center justify-center rounded-full ${muted ? 'bg-white text-ink' : 'bg-white/15 text-white'}`}
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
