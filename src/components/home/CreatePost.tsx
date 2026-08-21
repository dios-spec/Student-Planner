import { useRef, useState } from 'react';
import Modal from '../shared/Modal';
import { ImagePlus } from 'lucide-react';
import { uploadPostImage } from '../../firebase/storage';
import { createPost } from '../../firebase/posts';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function CreatePost({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function reset() {
    setFile(null);
    setPreview(null);
    setCaption('');
    setPosting(false);
  }

  async function handlePost() {
    if (!user || !profile || !file) return;
    setPosting(true);
    try {
      const url = await uploadPostImage(file, user.uid);
      await createPost({
        authorId: user.uid,
        authorName: profile.displayName,
        authorAvatar: profile.avatarUrl,
        imageUrl: url,
        caption: caption.trim() || undefined,
      });
      show('Posted!');
      reset();
      onClose();
    } catch {
      show("Couldn't post. Try again.");
      setPosting(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New Post">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = '';
        }}
      />

      {!preview ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-12 text-ink-soft"
        >
          <ImagePlus size={28} />
          <span className="text-sm font-medium">Choose a photo</span>
          <span className="text-xs">Images only — no videos</span>
        </button>
      ) : (
        <div className="space-y-4">
          <img src={preview} alt="Preview" className="max-h-72 w-full rounded-2xl object-contain bg-surface-alt" />
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Write a caption…"
            className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink-soft"
            >
              Change
            </button>
            <button
              onClick={handlePost}
              disabled={posting}
              className="flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Share'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
