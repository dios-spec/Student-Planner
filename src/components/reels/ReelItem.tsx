import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Send, Volume2, VolumeX, Play, Trash2, Bookmark } from 'lucide-react';
import Avatar from '../shared/Avatar';
import type { Reel } from '../../types';
import { toggleReelLike } from '../../firebase/reels';
import { useAuth } from '../../context/AuthContext';

interface ReelItemProps {
  reel: Reel;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenComments: (reelId: string) => void;
  onShare: (reel: Reel) => void;
  onDelete: (reel: Reel) => void;
  saved?: boolean;
  onToggleSave?: () => void;
}

export default function ReelItem({
  reel, active, muted, onToggleMute, onOpenProfile, onOpenComments, onShare, onDelete, saved, onToggleSave,
}: ReelItemProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);
  const liked = reel.likes?.includes(user?.uid || '') ?? false;
  const isMine = reel.authorId === user?.uid;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      v.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      v.pause();
    }
  }, [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  }

  return (
    <div className="relative h-full w-full snap-start bg-black">
      <video ref={videoRef} src={reel.videoUrl} poster={reel.thumbUrl} loop muted={muted} playsInline onClick={togglePlay} className="h-full w-full object-contain" />

      {paused && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center" aria-label="Play">
          <Play size={56} className="fill-white/80 text-white/80 drop-shadow-lg" />
        </button>
      )}

      <button onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] rounded-full bg-black/40 p-2 text-white">
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5">
        <button onClick={() => user && toggleReelLike(reel.id, user.uid, liked)} className="flex flex-col items-center gap-1 text-white" aria-label="Like">
          <Heart size={30} className={liked ? 'fill-coral text-coral' : ''} />
          <span className="text-xs font-semibold">{reel.likes?.length || 0}</span>
        </button>
        <button onClick={() => onOpenComments(reel.id)} className="flex flex-col items-center gap-1 text-white" aria-label="Comments"><MessageCircle size={30} /></button>
        <button onClick={() => onShare(reel)} className="flex flex-col items-center gap-1 text-white" aria-label="Share"><Send size={28} /></button>
        {onToggleSave && (
          <button onClick={onToggleSave} className="flex flex-col items-center gap-1 text-white" aria-label={saved ? 'Unsave' : 'Save'}>
            <Bookmark size={28} className={saved ? 'fill-white' : ''} />
          </button>
        )}
        {isMine && (
          <button onClick={() => onDelete(reel)} className="flex flex-col items-center gap-1 text-white" aria-label="Delete"><Trash2 size={26} /></button>
        )}
      </div>

      <div className="absolute bottom-6 left-4 right-20">
        <button onClick={() => onOpenProfile(reel.authorId)} className="mb-1.5 flex items-center gap-2">
          <Avatar name={reel.authorName} src={reel.authorAvatar} size="sm" />
          <span className="text-sm font-semibold text-white drop-shadow">{reel.authorName}</span>
        </button>
        {reel.caption && <p className="text-sm text-white/90 drop-shadow">{reel.caption}</p>}
      </div>
    </div>
  );
}
