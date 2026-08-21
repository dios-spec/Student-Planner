import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import Modal from '../shared/Modal';
import { DEFAULT_SUBJECTS } from '../../data/subjects';
import { uploadStudyImage } from '../../firebase/storage';
import { addStudyMaterial } from '../../firebase/study';
import { useAuth } from '../../context/AuthContext';
import { useActiveClass } from '../../context/ClassContext';
import { useToast } from '../../context/ToastContext';

export default function UploadStudyMaterial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { activeClass } = useActiveClass();
  const { show } = useToast();
  const [subject, setSubject] = useState('science');
  const [chapter, setChapter] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setChapter('');
    setTitle('');
    setFile(null);
    setPreview(null);
    setPosting(false);
  }

  async function handleUpload() {
    if (!user || !profile || !file || !chapter.trim() || !title.trim()) return;
    setPosting(true);
    try {
      const url = await uploadStudyImage(file, user.uid);
      await addStudyMaterial({
        classId: activeClass,
        subject,
        chapter: chapter.trim(),
        title: title.trim(),
        imageUrl: url,
        uploaderId: user.uid,
        uploaderName: profile.displayName,
        uploaderAvatar: profile.avatarUrl,
      });
      show('Study material shared!');
      reset();
      onClose();
    } catch {
      show("Couldn't upload. Try again.");
      setPosting(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={`Add to ${activeClass} Study Help`}>
      <div className="space-y-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
            e.target.value = '';
          }}
        />

        {!preview ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-ink-soft"
          >
            <ImagePlus size={26} />
            <span className="text-sm font-medium">Choose an image</span>
            <span className="text-xs">Mind map, notes, formula sheet, diagram…</span>
          </button>
        ) : (
          <div>
            <img src={preview} alt="Preview" className="max-h-56 w-full rounded-2xl object-contain bg-surface-alt" />
            <button onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-full border border-line py-2 text-sm text-ink-soft">
              Change image
            </button>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Subject</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SUBJECTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSubject(s.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  subject === s.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Chapter</label>
          <input
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="e.g. Chapter 5"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Photosynthesis mind map"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={posting || !file || !chapter.trim() || !title.trim()}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {posting ? 'Uploading…' : 'Share'}
        </button>
      </div>
    </Modal>
  );
}
