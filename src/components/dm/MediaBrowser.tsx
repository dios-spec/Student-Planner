import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Avatar from '../shared/Avatar';
import ImagePreviewModal from '../chat/ImagePreviewModal';
import VoicePlayer from './VoicePlayer';
import SharedPreview from './SharedPreview';
import EmptyState from '../shared/EmptyState';
import { getDMMediaOnce, getDMLinksOnce, getDMVoiceOnce, getDMSharedOnce } from '../../firebase/dm';
import { relativeTime } from '../../utils/date';
import type { DMMessage } from '../../types';

type Tab = 'media' | 'links' | 'voice' | 'shared';

const TABS: { key: Tab; label: string }[] = [
  { key: 'media', label: 'Media' },
  { key: 'links', label: 'Links' },
  { key: 'voice', label: 'Voice' },
  { key: 'shared', label: 'Shared' },
];

const URL_RE = /https?:\/\/[^\s]+/gi;

function linkify(text: string) {
  const parts = text.split(URL_RE);
  const urls = text.match(URL_RE) || [];
  const out: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    out.push(part);
    if (urls[i]) {
      out.push(
        <a key={i} href={urls[i]} target="_blank" rel="noreferrer" className="text-accent underline">
          {urls[i]}
        </a>
      );
    }
  });
  return out;
}

export default function MediaBrowser({
  conversationId,
  onBack,
  onOpenShared,
}: {
  conversationId: string;
  onBack: () => void;
  onOpenShared: (shared: NonNullable<DMMessage['shared']>) => void;
}) {
  const [tab, setTab] = useState<Tab>('media');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DMMessage[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetcher =
      tab === 'media' ? getDMMediaOnce :
      tab === 'links' ? getDMLinksOnce :
      tab === 'voice' ? getDMVoiceOnce :
      getDMSharedOnce;
    fetcher(conversationId)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, conversationId]);

  return (
    <div className="fixed inset-0 z-[105] flex flex-col bg-paper">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]">
        <button onClick={onBack} aria-label="Back" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
          <ArrowLeft size={20} />
        </button>
        <p className="font-display text-lg font-semibold text-ink">Media, Links & Shared</p>
      </header>

      <div className="flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={(tab === t.key ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft') + ' shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium'}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="flex justify-center pt-10">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <EmptyState emoji="📂" title={'No ' + tab + ' yet'} />
        )}

        {!loading && tab === 'media' && items.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((m) => (
              <button key={m.id} onClick={() => m.imageUrl && setPreviewUrl(m.imageUrl)} className="aspect-square overflow-hidden rounded-lg bg-surface-alt">
                <img src={m.imageUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {!loading && tab === 'links' && items.length > 0 && (
          <div className="space-y-2">
            {items.map((m) => (
              <div key={m.id} className="rounded-xl border border-line bg-surface p-3">
                <p className="break-words text-sm text-ink">{m.text ? linkify(m.text) : ''}</p>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {m.senderName} · {m.createdAt?.toDate ? relativeTime(m.createdAt.toDate()) : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'voice' && items.length > 0 && (
          <div className="space-y-2">
            {items.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-3">
                <Avatar name={m.senderName} src={m.senderAvatar} size="sm" />
                <div className="min-w-0 flex-1">
                  {m.audioUrl && <VoicePlayer url={m.audioUrl} duration={m.audioDuration} mine={false} />}
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {m.senderName} · {m.createdAt?.toDate ? relativeTime(m.createdAt.toDate()) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'shared' && items.length > 0 && (
          <div className="space-y-2">
            {items.map((m) => (
              <div key={m.id} className="rounded-xl border border-line bg-surface p-2.5">
                {m.shared && <SharedPreview shared={m.shared} onOpen={() => onOpenShared(m.shared!)} />}
                <p className="mt-1.5 px-0.5 text-[11px] text-ink-soft">
                  {m.senderName} · {m.createdAt?.toDate ? relativeTime(m.createdAt.toDate()) : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
