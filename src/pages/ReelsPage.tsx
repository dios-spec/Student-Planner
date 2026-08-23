import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ReelItem from '../components/reels/ReelItem';
import UploadReel from '../components/reels/UploadReel';
import CommentsSheet from '../components/home/CommentsSheet';
import ShareSheet, { type ShareContent } from '../components/dm/ShareSheet';
import ProfileView from '../components/profile/ProfileView';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import { useReels } from '../hooks/useReels';
import { deleteReel } from '../firebase/reels';
import type { Reel } from '../types';
import { useLiveProfiles, liveName, liveAvatar } from '../hooks/useLiveProfiles';
import { useSavedItems } from '../hooks/useSavedItems';
import { saveItem, unsaveItem } from '../firebase/saved';
import { useAuth } from '../context/AuthContext';

export default function ReelsPage() {
  const navigate = useNavigate();
  const { reels, loading } = useReels();
  const profiles = useLiveProfiles((reels || []).map((r) => r.authorId));
  const { user } = useAuth();
  const { isSaved } = useSavedItems(user?.uid);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareContent, setShareContent] = useState<ShareContent | null>(null);
  const [viewUid, setViewUid] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Detect which reel is centered in the viewport.
  useEffect(() => {
    if (!reels || reels.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            setActiveIdx(idx);
          }
        });
      },
      { threshold: [0.6] }
    );
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [reels]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-30 bg-black"
      style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
    >
      {loading && (
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        </div>
      )}

      {!loading && reels?.length === 0 && (
        <div className="flex h-full items-center justify-center px-6">
          <EmptyState emoji="🎬" title="No reels yet" subtitle="Tap + to post the first one!" />
        </div>
      )}

      <div
        ref={containerRef}
        className="h-full snap-y snap-mandatory overflow-y-scroll"
        style={{ scrollbarWidth: 'none' }}
      >
        {reels?.map((reel, i) => (
          <div
            key={reel.id}
            data-idx={i}
            ref={(el) => { itemRefs.current[i] = el; }}
            className="h-full w-full snap-start"
          >
            <ReelItem
              reel={{
                ...reel,
                authorName: liveName(profiles, reel.authorId, reel.authorName),
                authorAvatar: liveAvatar(profiles, reel.authorId, reel.authorAvatar),
              }}
              active={i === activeIdx}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              onOpenProfile={setViewUid}
              onOpenComments={setCommentsFor}
              onShare={(r) => setShareContent({ kind: 'reel', id: r.id, thumbUrl: r.thumbUrl, caption: r.caption, authorName: r.authorName })}
              onDelete={setDeleteTarget}
              saved={isSaved('reel', reel.id)}
              onToggleSave={() => user && (isSaved('reel', reel.id)
                ? unsaveItem(user.uid, 'reel', reel.id)
                : saveItem({ userId: user.uid, type: 'reel', refId: reel.id, title: reel.caption || 'Reel', imageUrl: reel.thumbUrl, authorName: reel.authorName }))}
            />
          </div>
        ))}
      </div>

      {/* upload button */}
      <button
        onClick={() => setUploadOpen(true)}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 rounded-full bg-accent p-2.5 text-white shadow-lg"
        aria-label="New reel"
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>

      <UploadReel open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} onOpenProfile={setViewUid} />
      <ShareSheet content={shareContent} onClose={() => setShareContent(null)} />
      <ProfileView
        uid={viewUid}
        onClose={() => setViewUid(null)}
        onImageClick={() => {}}
        onStartDM={(id) => { setViewUid(null); navigate(`/messages?open=${id}`); }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete reel?"
        message="This reel will be removed for everyone."
        confirmLabel="Delete"
        danger
        onConfirm={() => { if (deleteTarget) deleteReel(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
