import { useEffect, useRef, useState } from 'react';
import { X, Trash2, Heart, MessageCircle, Send } from 'lucide-react';
import Avatar from '../shared/Avatar';
import CommentsSheet from './CommentsSheet';
import ShareSheet, { type ShareContent } from '../dm/ShareSheet';
import type { StoryGroup } from '../../hooks/useStories';
import { markStorySeen, deleteStory, toggleStoryLike } from '../../firebase/stories';
import { useAuth } from '../../context/AuthContext';
import { relativeTime } from '../../utils/date';

interface StoryViewerProps {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
  onOpenProfile?: (uid: string) => void;
}

const STORY_MS = 5000;

export default function StoryViewer({ groups, startIndex, onClose, onOpenProfile }: StoryViewerProps) {
  const { user } = useAuth();
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareContent, setShareContent] = useState<ShareContent | null>(null);
  const timerRef = useRef<number | null>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  useEffect(() => {
    if (!story || !user) return;
    markStorySeen(story.id, user.uid);
    setProgress(0);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / STORY_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        advance();
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };
    timerRef.current = requestAnimationFrame(tick);
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx]);

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

  if (!group || !story) return null;
  const isMine = story.authorId === user?.uid;
  const liked = story.likes?.includes(user?.uid || '') ?? false;
  const createdDate = story.createdAt?.toDate ? story.createdAt.toDate() : new Date();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex gap-1 px-3 pt-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {group.stories.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white"
              style={{ width: i < storyIdx ? '100%' : i === storyIdx ? progress + '%' : '0%' }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => onOpenProfile?.(group.authorId)} className="flex items-center gap-2">
          <Avatar name={group.authorName} src={group.authorAvatar} size="sm" />
          <span className="text-sm font-semibold text-white">{group.authorName}</span>
        </button>
        <span className="text-xs text-white/60">{relativeTime(createdDate)}</span>
        <div className="ml-auto flex items-center gap-3">
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
        {story.mediaType === 'video' ? (
          <video src={story.imageUrl} autoPlay playsInline className="max-h-full max-w-full object-contain" />
        ) : (
          <img src={story.imageUrl} alt="Story" className="max-h-full max-w-full object-contain" />
        )}
        <button className="absolute inset-y-0 left-0 w-1/3" onClick={back} aria-label="Previous" />
        <button className="absolute inset-y-0 right-0 w-2/3" onClick={advance} aria-label="Next" />
      </div>

      <div className="flex items-center gap-5 px-4 py-3.5">
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
