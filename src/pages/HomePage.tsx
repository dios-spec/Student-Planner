import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bell, MessageCircle, CalendarClock, Search } from 'lucide-react';
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
import SmartDashboard from '../components/home/SmartDashboard';
import { useLiveProfiles, liveName, liveAvatar } from '../hooks/useLiveProfiles';
import { useSavedItems } from '../hooks/useSavedItems';
import { saveItem, unsaveItem } from '../firebase/saved';
import SearchOverlay from '../components/shared/SearchOverlay';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unread } = useNotifications(user?.uid);
  const { posts, loading } = useFeed();
  const { groups } = useStories();
  const profiles = useLiveProfiles([
    ...(posts || []).map((p) => p.authorId),
    ...groups.map((g) => g.authorId),
  ]);
  const liveGroups = useMemo(() => groups.map((group) => ({
    ...group,
    authorName: liveName(profiles, group.authorId, group.authorName),
    authorAvatar: liveAvatar(profiles, group.authorId, group.authorAvatar),
  })), [groups, profiles]);
  const { isSaved } = useSavedItems(user?.uid);
  const [storyStart, setStoryStart] = useState<number | null>(null);
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [viewUid, setViewUid] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [shareContent, setShareContent] = useState<ShareContent | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="social-texture pb-24">
      <TopBar
        title="Home"
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchOpen(true)} aria-label="Search app" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <Search size={20} />
            </button>
            <button onClick={() => navigate('/upcoming')} aria-label="Upcoming" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <CalendarClock size={20} />
            </button>
            <button onClick={() => navigate('/chat')} aria-label="Class chat" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <MessageCircle size={20} />
            </button>
            <button onClick={() => navigate('/notifications')} aria-label="Notifications" className="relative rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-3xs font-bold text-white">
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

      <SmartDashboard />

      <div className="border-b border-line">
        <StoryBar
          groups={liveGroups}
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
        {posts?.map((post, index) => (
          <PostCard
            key={post.id}
            post={{
              ...post,
              authorName: liveName(profiles, post.authorId, post.authorName),
              authorAvatar: liveAvatar(profiles, post.authorId, post.authorAvatar),
            }}
            onOpenProfile={setViewUid}
            onImageClick={setPreviewUrl}
            onOpenComments={setCommentsPostId}
            onShare={(p) => setShareContent({ kind: 'post', id: p.id, imageUrl: p.imageUrl, caption: p.caption, authorName: p.authorName })}
            saved={isSaved('post', post.id)}
            priority={index === 0}
            onToggleSave={() => user && (isSaved('post', post.id)
              ? unsaveItem(user.uid, 'post', post.id)
              : saveItem({ userId: user.uid, type: 'post', refId: post.id, title: post.caption || 'Post', imageUrl: post.imageUrl, authorName: post.authorName }))}
          />
        ))}
      </div>

      {storyStart !== null && (
        <StoryViewer groups={liveGroups} startIndex={storyStart} onClose={() => setStoryStart(null)} onOpenProfile={setViewUid} />
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
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
