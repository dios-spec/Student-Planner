import { Heart, Trash2, MessageCircle, Send, Bookmark } from 'lucide-react';
import Avatar from '../shared/Avatar';
import type { Post } from '../../types';
import { toggleLike, deletePost } from '../../firebase/posts';
import { useAuth } from '../../context/AuthContext';
import { relativeTime } from '../../utils/date';
import StudentMeritPill from '../merit/StudentMeritPill';

export default function PostCard({
  post, onOpenProfile, onImageClick, onOpenComments, onShare, saved, onToggleSave, priority = false,
}: {
  post: Post;
  onOpenProfile: (uid: string) => void;
  onImageClick: (url: string) => void;
  onOpenComments: (postId: string) => void;
  onShare: (post: Post) => void;
  saved?: boolean;
  onToggleSave?: () => void;
  priority?: boolean;
}) {
  const { user } = useAuth();
  const liked = post.likes?.includes(user?.uid || '') ?? false;
  const likeCount = post.likes?.length ?? 0;
  const isMine = post.authorId === user?.uid;
  const createdDate = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();

  return (
    <article className="render-later border-b border-line bg-surface">
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <button type="button" onClick={() => onOpenProfile(post.authorId)} aria-label={`Open ${post.authorName}'s profile`}>
          <Avatar name={post.authorName} src={post.authorAvatar} size="sm" />
        </button>
        <div className="min-w-0">
          <button type="button" onClick={() => onOpenProfile(post.authorId)} className="block truncate text-sm font-semibold text-ink">{post.authorName}</button>
          <StudentMeritPill uid={post.authorId} size="micro" />
        </div>
        <span className="ml-auto text-xs text-ink-soft">{relativeTime(createdDate)}</span>
        {isMine && (
          <button type="button" onClick={() => deletePost(post.id)} aria-label="Delete post" className="rounded-full p-2 text-ink-soft hover:text-coral"><Trash2 size={16} /></button>
        )}
      </div>

      <button type="button" onClick={() => onImageClick(post.imageUrl)} className="block w-full" aria-label="Open post image">
        <img
          src={post.imageUrl}
          alt={post.caption || 'Post'}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="max-h-[70vh] w-full bg-surface-alt object-contain"
        />
      </button>

      <div className="px-4 py-2.5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => user && toggleLike(post.id, user.uid, liked)} className="flex items-center gap-1.5" aria-label={liked ? 'Unlike' : 'Like'}>
            <Heart size={22} className={liked ? 'fill-coral text-coral' : 'text-ink'} strokeWidth={2} />
            {likeCount > 0 && <span className="text-sm font-medium text-ink">{likeCount}</span>}
          </button>
          <button type="button" onClick={() => onOpenComments(post.id)} className="flex items-center gap-1.5" aria-label="Comments"><MessageCircle size={22} className="text-ink" strokeWidth={2} /></button>
          <button type="button" onClick={() => onShare(post)} className="flex items-center gap-1.5" aria-label="Share"><Send size={22} className="text-ink" strokeWidth={2} /></button>
          {onToggleSave && (
            <button type="button" onClick={onToggleSave} className="ml-auto flex items-center gap-1.5" aria-label={saved ? 'Unsave' : 'Save'}>
              <Bookmark size={22} className={saved ? 'fill-ink text-ink' : 'text-ink'} strokeWidth={2} />
            </button>
          )}
        </div>
        {post.caption && (
          <p className="mt-1.5 text-sm text-ink"><span className="font-semibold">{post.authorName}</span> {post.caption}</p>
        )}
        <button type="button" onClick={() => onOpenComments(post.id)} className="mt-1 text-xs text-ink-soft">View comments</button>
      </div>
    </article>
  );
}
