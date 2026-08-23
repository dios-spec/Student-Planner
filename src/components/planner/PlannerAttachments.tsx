import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import ImagePreviewModal from '../chat/ImagePreviewModal';
import type { PlannerAttachment } from '../../types';

interface PlannerAttachmentsProps {
  attachments?: PlannerAttachment[];
  compact?: boolean;
}

export default function PlannerAttachments({ attachments, compact = false }: PlannerAttachmentsProps) {
  const [preview, setPreview] = useState<string | null>(null);
  if (!attachments?.length) return null;

  const visible = attachments.slice(0, compact ? 2 : 4);
  const remaining = attachments.length - visible.length;

  return (
    <>
      <div className={`mt-2 flex gap-1.5 overflow-hidden ${compact ? 'max-w-36' : ''}`}>
        {visible.map((attachment, index) => (
          <button
            type="button"
            key={`${attachment.url}-${index}`}
            onClick={(event) => { event.stopPropagation(); setPreview(attachment.url); }}
            aria-label={`Open attachment ${index + 1}${attachment.name ? `: ${attachment.name}` : ''}`}
            className={`relative shrink-0 overflow-hidden rounded-lg border border-line bg-surface-alt ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}
          >
            <img src={attachment.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            {index === visible.length - 1 && remaining > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-bold text-white">+{remaining}</span>
            )}
          </button>
        ))}
        {!compact && (
          <span className="flex items-center gap-1 self-end pb-1 text-[11px] text-ink-soft">
            <ImageIcon size={12} /> {attachments.length}
          </span>
        )}
      </div>
      <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />
    </>
  );
}
