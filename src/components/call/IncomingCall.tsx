import { useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import Avatar from '../shared/Avatar';
import { startRingtone, stopRingtone } from '../../utils/ringtone';
import type { CallDoc } from '../../types';

/** Full-screen incoming-call UI with ringtone. Shown when the app is open. */
export default function IncomingCall({
  call,
  onAccept,
  onDecline,
}: {
  call: CallDoc;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isGroup = call.type === 'group';

  useEffect(() => {
    startRingtone();
    return () => stopRingtone();
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-gradient-to-b from-[#1a1d29] to-[#0e1016] px-6 py-16 pt-[calc(env(safe-area-inset-top)+4rem)]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <div className="scale-150">
            <Avatar
              name={isGroup ? call.groupName || 'Group' : call.callerName}
              src={isGroup ? call.groupPhoto : call.callerAvatar}
              size="lg"
            />
          </div>
        </div>
        <div className="mt-4 text-center">
          <h1 className="font-display text-2xl font-bold text-white">
            {isGroup ? call.groupName : call.callerName}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {isGroup ? 'Incoming group voice call' : 'Incoming voice call'}
          </p>
          {isGroup && <p className="text-xs text-white/50">{call.callerName} is calling</p>}
        </div>
      </div>

      <div className="flex w-full max-w-xs items-center justify-between">
        <button onClick={onDecline} className="flex flex-col items-center gap-2" aria-label="Decline">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-coral text-white">
            <PhoneOff size={26} />
          </span>
          <span className="text-xs text-white/70">Decline</span>
        </button>
        <button onClick={onAccept} className="flex flex-col items-center gap-2" aria-label="Accept">
          <span className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-success text-white">
            <Phone size={26} />
          </span>
          <span className="text-xs text-white/70">Accept</span>
        </button>
      </div>
    </div>
  );
}
