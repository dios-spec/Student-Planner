import { Pin, X } from 'lucide-react';
import type { PinnedMessage } from '../../types';

interface PinnedBarProps {
  pinned: PinnedMessage[];
  onUnpin: (messageId: string) => void;
}

/** Horizontal strip of pinned-message chips. Renders nothing when the list is empty. */
export default function PinnedBar({ pinned, onUnpin }: PinnedBarProps) {
  if (pinned.length === 0) return null;

  return (
    <div className="border-b border-line bg-accent-soft/40 px-3 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {pinned.map((p) => (
          <div
            key={p.messageId}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs shadow-sm"
          >
            <Pin size={12} className="shrink-0 text-accent" />
            <span className="max-w-[160px] truncate text-ink">
              <span className="font-semibold">{p.senderName}: </span>
              {p.text || 'Message'}
            </span>
            <button onClick={() => onUnpin(p.messageId)} aria-label="Unpin" className="shrink-0 text-ink-soft hover:text-coral">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
