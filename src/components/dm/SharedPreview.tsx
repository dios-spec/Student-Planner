import { Play, ImageIcon } from 'lucide-react';
import type { DMMessage } from '../../types';

/** Embedded preview for a shared post/reel inside a chat bubble. */
export default function SharedPreview({
  shared,
  mine,
  onOpen,
}: {
  shared: NonNullable<DMMessage['shared']>;
  mine?: boolean;
  onOpen: () => void;
}) {
  const isReel = shared.kind === 'reel';
  const isStory = shared.kind === 'story';
  const img = shared.thumbUrl || shared.imageUrl;

  return (
    <button
      onClick={onOpen}
      className={`mt-0.5 flex w-full items-center gap-2.5 overflow-hidden rounded-xl border text-left ${
        mine ? 'border-white/25 bg-white/10' : 'border-line bg-surface-alt'
      }`}
    >
      <div className="relative h-16 w-16 shrink-0 bg-black/10">
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon size={20} className="opacity-50" />
          </div>
        )}
        {isReel && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Play size={20} className="fill-white text-white drop-shadow" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-1 pr-2">
        <p className={`text-xs font-semibold ${mine ? 'text-white' : 'text-ink'}`}>
          {isReel ? '🎬 Reel' : isStory ? '📸 Story' : '📮 Post'} · {shared.authorName}
        </p>
        {shared.caption && (
          <p className={`truncate text-xs ${mine ? 'text-white/70' : 'text-ink-soft'}`}>
            {shared.caption}
          </p>
        )}
      </div>
    </button>
  );
}
