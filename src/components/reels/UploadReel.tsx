import { useRef, useState } from 'react';
import { Film } from 'lucide-react';
import Modal from '../shared/Modal';
import { uploadReelVideo } from '../../firebase/storage';
import { createReel } from '../../firebase/reels';
import { validateVideoFile, getVideoDuration, MAX_VIDEO_SECONDS } from '../../utils/image';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function UploadReel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(f: File) {
    setErr(null);
    const vErr = validateVideoFile(f);
    if (vErr) { setErr(vErr); return; }
    try {
      const dur = await getVideoDuration(f);
      if (dur > MAX_VIDEO_SECONDS) {
        setErr(`Video is too long (max ${MAX_VIDEO_SECONDS}s). Yours is ${Math.round(dur)}s.`);
        return;
      }
    } catch {
      setErr("Couldn't read that video.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function reset() {
    setFile(null); setPreview(null); setCaption(''); setUploading(false); setErr(null);
  }

  async function handleUpload() {
    if (!user || !profile || !file) return;
    setUploading(true);
    try {
      const { videoUrl, thumbUrl } = await uploadReelVideo(file, user.uid);
      await createReel({
        authorId: user.uid,
        authorName: profile.displayName,
        authorAvatar: profile.avatarUrl,
        videoUrl,
        thumbUrl,
        caption: caption.trim() || undefined,
      });
      show('Reel posted! 🎬');
      reset();
      onClose();
    } catch {
      show("Couldn't upload reel. Try again.");
      setUploading(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New Reel">
      <input ref={fileRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />

      {err && <p className="mb-3 rounded-lg bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}

      {!preview ? (
        <button onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-12 text-ink-soft">
          <Film size={28} />
          <span className="text-sm font-medium">Choose a video</span>
          <span className="text-xs">Max {MAX_VIDEO_SECONDS}s · 30MB · MP4/WebM</span>
        </button>
      ) : (
        <div className="space-y-4">
          <video src={preview} controls playsInline className="max-h-72 w-full rounded-2xl bg-black object-contain" />
          <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 300))} rows={2}
            placeholder="Add a caption…"
            className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent" />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink-soft">
              Change
            </button>
            <button onClick={handleUpload} disabled={uploading}
              className="flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {uploading ? 'Uploading…' : 'Share Reel'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
