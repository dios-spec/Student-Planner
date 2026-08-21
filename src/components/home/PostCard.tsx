import { Heart, Trash2, MessageCircle, Send } from 'lucide-react';
import Avatar from '../shared/Avatar';
import type { Post } from '../../types';
import { toggleLike, deletePost } from '../../firebase/posts';
import { useAuth } from '../../context/AuthContext';
import { relativeTime } from '../../utils/date';

export default function PostCard({
  post,
  onOpenProfile,
  onImageClick,
  onOpenComments,
  onShare,
}: {
  post: Post;
  onOpenProfile: (uid: string) => void;
  onImageClick: (url: string) => void;
  onOpenComments: (postId: string) => void;
  onShare: (post: Post) => void;
}) {
  const { user } = useAuth();
  const liked = post.likes?.includes(user?.uid || '') ?? false;
  const likeCount = post.likes?.length ?? 0;
  const isMine = post.authorId === user?.uid;
  const createdDate = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();

  return (
    <article className="border-b border-line bg-surface">
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <button onClick={() => onOpenProfile(post.authorId)}>
          <Avatar name={post.authorName} src={post.authorAvatar} size="sm" />
        </button>
        <button onClick={() => onOpenProfile(post.authorId)} className="text-sm font-semibold text-ink">
          {post.authorName}
        </button>
        <span className="ml-auto text-xs text-ink-soft">{relativeTime(createdDate)}</span>
        {isMine && (
          <button onClick={() => deletePost(post.id)} aria-label="Delete post" className="text-ink-soft hover:text-coral">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <img
        src={post.imageUrl}
        alt={post.caption || 'Post'}
        onClick={() => onImageClick(post.imageUrl)}
        className="max-h-[70vh] w-full cursor-pointer bg-surface-alt object-contain"
      />

      <div className="px-4 py-2.5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => user && toggleLike(post.id, user.uid, liked)}
            className="flex items-center gap-1.5"
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Heart size={22} className={liked ? 'fill-coral text-coral' : 'text-ink'} strokeWidth={2} />
            {likeCount > 0 && <span className="text-sm font-medium text-ink">{likeCount}</span>}
          </button>
          <button
            onClick={() => onOpenComments(post.id)}
            className="flex items-center gap-1.5"
            aria-label="Comments"
          >
            <MessageCircle size={22} className="text-ink" strokeWidth={2} />
          </button>
          <button onClick={() => onShare(post)} className="flex items-center gap-1.5" aria-label="Share">
            <Send size={22} className="text-ink" strokeWidth={2} />
          </button>
        </div>
        {post.caption && (
          <p className="mt-1.5 text-sm text-ink">
            <span className="font-semibold">{post.authorName}</span> {post.caption}
          </p>
        )}
        <button
          onClick={() => onOpenComments(post.id)}
          className="mt-1 text-xs text-ink-soft"
        >
          View comments
        </button>
      </div>
    </article>
  );
}
