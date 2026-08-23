import { useEffect, useRef, useState } from 'react';
import { X, Trash2, Heart, MessageCircle, Send, Volume2, VolumeX } from 'lucide-react';
import Avatar from '../shared/Avatar';
import CommentsSheet from './CommentsSheet';
import ShareSheet, { type ShareContent } from '../dm/ShareSheet';
import type { StoryGroup } from '../../hooks/useStories';
import { markStorySeen, deleteStory, toggleStoryLike } from '../../firebase/stories';
import { useAuth } from '../../context/AuthContext';
import { relativeTime } from '../../utils/date';
import StudentMeritPill from '../merit/StudentMeritPill';

interface StoryViewerProps {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
  onOpenProfile?: (uid: string) => void;
}

const STORY_MS = 5000;
const HOLD_MS = 180;

export default function StoryViewer({ groups, startIndex, onClose, onOpenProfile }: StoryViewerProps) {
  const { user } = useAuth();
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareContent, setShareContent] = useState<ShareContent | null>(null);
  const [holding, setHolding] = useState(false);
  const [muted, setMuted] = useState(true);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  const paused = holding || commentsFor !== null || !!shareContent;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!story || !user) return;
    markStorySeen(story.id, user.uid);
    setProgress(0);
    elapsedRef.current = 0;
    lastFrameRef.current = null;

    function tick(now: number) {
      if (lastFrameRef.current == null) lastFrameRef.current = now;
      if (!pausedRef.current) {
        elapsedRef.current += now - lastFrameRef.current;
      }
      lastFrameRef.current = now;
      const pct = Math.min(100, (elapsedRef.current / STORY_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        advance();
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    }
    timerRef.current = requestAnimationFrame(tick);
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused]);

  // Same React <video> quirk as Reels: `muted` doesn't reliably reapply via
  // the JSX prop after mount, so set it imperatively.
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted, storyIdx, groupIdx]);

  function advance() {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((s) => s + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }

  function back() {
    if (storyIdx > 0) {
      setStoryIdx((s) => s - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((g) => g - 1);
      setStoryIdx(0);
    }
  }

  function startPress() {
    holdTimerRef.current = window.setTimeout(() => setHolding(true), HOLD_MS);
  }

  function endPress(side: 'left' | 'right') {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holding) {
      setHolding(false);
      return;
    }
    if (side === 'left') back();
    else advance();
  }

  function cancelPress() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHolding(false);
  }

  if (!group || !story) return null;
  const isMine = story.authorId === user?.uid;
  const liked = story.likes?.includes(user?.uid || '') ?? false;
  const createdDate = story.createdAt?.toDate ? story.createdAt.toDate() : new Date();
  const chromeHidden = holding;
  const isVideo = story.mediaType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div
        className={
          "flex gap-1 px-3 pt-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] transition-opacity duration-150 " +
          (chromeHidden ? "pointer-events-none opacity-0" : "opacity-100")
        }
      >
        {group.stories.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white"
              style={{ width: i < storyIdx ? '100%' : i === storyIdx ? progress + '%' : '0%' }}
            />
          </div>
        ))}
      </div>

      <div
        className={
          "flex items-center gap-2 px-4 py-3 transition-opacity duration-150 " +
          (chromeHidden ? "pointer-events-none opacity-0" : "opacity-100")
        }
      >
        <button onClick={() => onOpenProfile?.(group.authorId)} className="flex items-center gap-2">
          <Avatar name={group.authorName} src={group.authorAvatar} size="sm" />
          <span className="text-sm font-semibold text-white">{group.authorName}</span>
          <StudentMeritPill uid={group.authorId} size="micro" variant="dark" />
        </button>
        <span className="text-xs text-white/60">{relativeTime(createdDate)}</span>
        <div className="ml-auto flex items-center gap-3">
          {isVideo && (
            <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="text-white">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
          {isMine && (
            <button
              onClick={() => {
                deleteStory(story.id);
                advance();
              }}
              aria-label="Delete story"
              className="text-white/80"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="text-white">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {isVideo ? (
          <video
            ref={videoRef}
            src={story.imageUrl}
            autoPlay
            playsInline
            muted={muted}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <img src={story.imageUrl} alt="Story" className="max-h-full max-w-full object-contain" />
        )}
        <button
          className="absolute inset-y-0 left-0 w-1/3"
          onPointerDown={startPress}
          onPointerUp={() => endPress('left')}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          aria-label="Previous / hold to pause"
        />
        <button
          className="absolute inset-y-0 right-0 w-2/3"
          onPointerDown={startPress}
          onPointerUp={() => endPress('right')}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          aria-label="Next / hold to pause"
        />
      </div>

      <div
        className={
          "flex items-center gap-5 px-4 py-3.5 transition-opacity duration-150 " +
          (chromeHidden ? "pointer-events-none opacity-0" : "opacity-100")
        }
      >
        <button
          onClick={() => user && toggleStoryLike(story.id, user.uid, liked)}
          className="flex items-center gap-1.5 text-white"
          aria-label="Like"
        >
          <Heart size={24} className={liked ? 'fill-coral text-coral' : ''} />
          {(story.likes?.length ?? 0) > 0 && (
            <span className="text-xs text-white/80">{story.likes?.length}</span>
          )}
        </button>
        <button onClick={() => setCommentsFor(story.id)} className="text-white" aria-label="Comment">
          <MessageCircle size={24} />
        </button>
        <button
          onClick={() =>
            setShareContent({
              kind: 'story',
              id: story.id,
              imageUrl: story.imageUrl,
              authorName: group.authorName,
            })
          }
          className="text-white"
          aria-label="Share"
        >
          <Send size={22} />
        </button>
      </div>

      <CommentsSheet
        postId={commentsFor}
        onClose={() => setCommentsFor(null)}
        onOpenProfile={(uid) => onOpenProfile?.(uid)}
      />
      <ShareSheet content={shareContent} onClose={() => setShareContent(null)} />
    </div>
  );
}
