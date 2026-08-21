import { useRef, useState } from 'react';
import Modal from '../shared/Modal';
import { uploadStoryImage, uploadStoryVideo } from '../../firebase/storage';
import { createStory } from '../../firebase/stories';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ImagePlus } from 'lucide-react';
import { validateVideoFile, getVideoDuration } from '../../utils/image';

const MAX_STORY_VIDEO_SECONDS = 30;

export default function CreateStory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(f: File) {
    setErr(null);
    const video = f.type.startsWith('video/');
    if (video) {
      const vErr = validateVideoFile(f);
      if (vErr) { setErr(vErr); return; }
      try {
        const dur = await getVideoDuration(f);
        if (dur > MAX_STORY_VIDEO_SECONDS) { setErr(`Story videos max ${MAX_STORY_VIDEO_SECONDS}s.`); return; }
      } catch { setErr("Couldn't read that video."); return; }
    }
    setFile(f);
    setIsVideo(video);
    setPreview(URL.createObjectURL(f));
  }

  function reset() { setFile(null); setPreview(null); setIsVideo(false); setPosting(false); setErr(null); }

  async function handlePost() {
    if (!user || !profile || !file) return;
    setPosting(true);
    try {
      const url = isVideo ? await uploadStoryVideo(file, user.uid) : await uploadStoryImage(file, user.uid);
      await createStory({
        authorId: user.uid,
        authorName: profile.displayName,
        authorAvatar: profile.avatarUrl,
        imageUrl: url,
        mediaType: isVideo ? 'video' : 'image',
      });
      show('Story posted! Gone in 24 hours.');
      reset();
      onClose();
    } catch {
      show("Couldn't post story.");
      setPosting(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add to your story">
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />

      {err && <p className="mb-3 rounded-lg bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}

      {!preview ? (
        <button onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-12 text-ink-soft">
          <ImagePlus size={28} />
          <span className="text-sm font-medium">Choose photo or video</span>
          <span className="text-xs">Video max 30s</span>
        </button>
      ) : (
        <div className="space-y-4">
          {isVideo ? (
            <video src={preview} controls playsInline className="max-h-80 w-full rounded-2xl bg-black object-contain" />
          ) : (
            <img src={preview} alt="Preview" className="max-h-80 w-full rounded-2xl object-contain bg-surface-alt" />
          )}
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink-soft">Change</button>
            <button onClick={handlePost} disabled={posting} className="flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {posting ? 'Posting…' : 'Share Story'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
