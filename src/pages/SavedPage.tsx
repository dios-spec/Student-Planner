import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, Trash2 } from 'lucide-react';
import EmptyState from '../components/shared/EmptyState';
import ImagePreviewModal from '../components/chat/ImagePreviewModal';
import { useAuth } from '../context/AuthContext';
import { useSavedItems } from '../hooks/useSavedItems';
import { unsaveItem } from '../firebase/saved';
import type { SavedItem } from '../types';

const TYPE_LABEL: Record<string, string> = {
  message: 'Class Chat',
  dmMessage: 'Message',
  post: 'Post',
  reel: 'Reel',
  study: 'Study Help',
};

export default function SavedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items } = useSavedItems(user?.uid);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function open(item: SavedItem) {
    if ((item.type === 'post' || item.type === 'reel' || item.type === 'study') && item.imageUrl) {
      setPreviewUrl(item.imageUrl);
    } else if (item.type === 'dmMessage' && item.conversationId) {
      navigate('/messages?open=' + item.conversationId);
    } else if (item.type === 'message') {
      navigate('/chat');
    }
  }

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/95 px-2 py-3 pt-[env(safe-area-inset-top)] backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
          <ArrowLeft size={20} />
        </button>
        <p className="font-display text-lg font-semibold text-ink">Saved</p>
      </header>

      {items.length === 0 ? (
        <div className="px-4 pt-8">
          <EmptyState emoji="🔖" title="Nothing saved yet" subtitle="Tap the bookmark icon on a post, reel, message, or study material to save it here." />
        </div>
      ) : (
        <div className="divide-y divide-line px-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-2 py-3">
              <button onClick={() => open(item)} className="flex flex-1 items-center gap-3 text-left">
                {item.imageUrl ? (
                  <img loading="lazy" decoding="async" src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Bookmark size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-ink-soft">{TYPE_LABEL[item.type]}</p>
                  <p className="truncate text-sm text-ink">{item.title}</p>
                  {item.authorName && <p className="truncate text-xs text-ink-soft">{item.authorName}</p>}
                </div>
              </button>
              <button
                onClick={() => unsaveItem(item.userId, item.type, item.refId)}
                aria-label="Remove from saved"
                className="shrink-0 rounded-full p-1.5 text-ink-soft hover:text-coral"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
