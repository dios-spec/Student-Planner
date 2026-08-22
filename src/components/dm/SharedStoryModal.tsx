import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getStoryOnce } from '../../firebase/stories';
import type { Story } from '../../types';

export default function SharedStoryModal({
  storyId,
  onClose,
}: {
  storyId: string | null;
  onClose: () => void;
}) {
  const [story, setStory] = useState<Story | null | undefined>(undefined);

  useEffect(() => {
    if (!storyId) { setStory(undefined); return; }
    setStory(undefined);
    getStoryOnce(storyId).then((s) => {
      const expired = !s || (s.expiresAt ? s.expiresAt.toMillis() < Date.now() : false);
      setStory(expired ? null : s);
    });
  }, [storyId]);

  if (!storyId) return null;

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-black">
      <div className="flex justify-end px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button onClick={onClose} aria-label="Close" className="text-white">
          <X size={24} />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-6">
        {story === undefined && (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        )}
        {story === null && (
          <p className="text-center text-sm text-white/70">This story is no longer available.</p>
        )}
        {story && story.mediaType === 'video' && (
          <video src={story.imageUrl} autoPlay playsInline controls className="max-h-full max-w-full object-contain" />
        )}
        {story && story.mediaType !== 'video' && (
          <img src={story.imageUrl} alt="Story" className="max-h-full max-w-full object-contain" />
        )}
      </div>
    </div>
  );
}
