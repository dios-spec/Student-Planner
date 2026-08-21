import { Trash2, Send } from 'lucide-react';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** The inline bar shown while recording — timer, cancel, send. */
export default function VoiceRecorderBar({
  seconds,
  onCancel,
  onSend,
}: {
  seconds: number;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-coral-soft px-4 py-2.5">
      <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-coral" />
      <span className="text-sm font-medium text-coral">Recording… {fmt(seconds)}</span>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onCancel} aria-label="Cancel" className="rounded-full p-2 text-coral">
          <Trash2 size={18} />
        </button>
        <button onClick={onSend} aria-label="Send voice message" className="rounded-full bg-accent p-2 text-white">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
