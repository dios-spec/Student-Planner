import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bell, MessageCircle, CalendarClock } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import StoryBar from '../components/home/StoryBar';
import StoryViewer from '../components/home/StoryViewer';
import CreateStory from '../components/home/CreateStory';
import PostCard from '../components/home/PostCard';
import CreatePost from '../components/home/CreatePost';
import CommentsSheet from '../components/home/CommentsSheet';
import ShareSheet, { type ShareContent } from '../components/dm/ShareSheet';
import ProfileView from '../components/profile/ProfileView';
import ImagePreviewModal from '../components/chat/ImagePreviewModal';
import EmptyState from '../components/shared/EmptyState';
import { PlannerSkeleton } from '../components/shared/Skeleton';
import { useFeed } from '../hooks/useFeed';
import { useStories } from '../hooks/useStories';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unread } = useNotifications(user?.uid);
  const { posts, loading } = useFeed();
  const { groups } = useStories();
  const [storyStart, setStoryStart] = useState<number | null>(null);
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [viewUid, setViewUid] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [shareContent, setShareContent] = useState<ShareContent | null>(null);

  return (
    <div className="pb-24">
      <TopBar
        title="Home"
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('/upcoming')} aria-label="Upcoming" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <CalendarClock size={20} />
            </button>
            <button onClick={() => navigate('/chat')} aria-label="Class chat" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <MessageCircle size={20} />
            </button>
            <button onClick={() => navigate('/notifications')} aria-label="Notifications" className="relative rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <button onClick={() => setCreatePostOpen(true)} aria-label="New post" className="rounded-full bg-accent p-2 text-white">
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        }
      />

      <div className="border-b border-line">
        <StoryBar
          groups={groups}
          onOpenGroup={(i) => setStoryStart(i)}
          onCreate={() => setCreateStoryOpen(true)}
        />
      </div>

      {loading && <div className="pt-4"><PlannerSkeleton /></div>}

      {!loading && posts?.length === 0 && (
        <div className="px-4 pt-6">
          <EmptyState emoji="📷" title="No posts yet" subtitle="Tap + to share the first photo!" />
        </div>
      )}

      <div>
        {posts?.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onOpenProfile={setViewUid}
            onImageClick={setPreviewUrl}
            onOpenComments={setCommentsPostId}
            onShare={(p) => setShareContent({ kind: 'post', id: p.id, imageUrl: p.imageUrl, caption: p.caption, authorName: p.authorName })}
          />
        ))}
      </div>

      {storyStart !== null && (
        <StoryViewer groups={groups} startIndex={storyStart} onClose={() => setStoryStart(null)} />
      )}
      <CreateStory open={createStoryOpen} onClose={() => setCreateStoryOpen(false)} />
      <CreatePost open={createPostOpen} onClose={() => setCreatePostOpen(false)} />
      <CommentsSheet
        postId={commentsPostId}
        onClose={() => setCommentsPostId(null)}
        onOpenProfile={setViewUid}
      />
      <ShareSheet content={shareContent} onClose={() => setShareContent(null)} />
      <ProfileView uid={viewUid} onClose={() => setViewUid(null)} onImageClick={setPreviewUrl} onStartDM={(id) => { setViewUid(null); navigate(`/messages?open=${id}`); }} />
      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
