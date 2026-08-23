import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import Modal from '../shared/Modal';
import { DEFAULT_SUBJECTS } from '../../data/subjects';
import { STUDY_KIND_META, STUDY_KIND_ORDER } from '../../data/study';
import { uploadStudyImage } from '../../firebase/storage';
import { addStudyMaterial } from '../../firebase/study';
import { useAuth } from '../../context/AuthContext';
import { useActiveClass } from '../../context/ClassContext';
import { useToast } from '../../context/ToastContext';
import { validateImageFile } from '../../utils/image';
import type { StudyMaterialKind } from '../../types';

export default function UploadStudyMaterial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { activeClass } = useActiveClass();
  const { show } = useToast();
  const [subject, setSubject] = useState('science');
  const [customSubject, setCustomSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<StudyMaterialKind>('notes');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const finalSubject = subject === '__custom'
    ? customSubject.trim().toLowerCase().replace(/\s+/g, '-')
    : subject;

  function reset() {
    setSubject('science');
    setCustomSubject('');
    setChapter('');
    setTitle('');
    setDescription('');
    setKind('notes');
    setFile(null);
    setPreview(null);
    setPosting(false);
  }

  function chooseFile(next: File | undefined) {
    if (!next) return;
    const error = validateImageFile(next);
    if (error) {
      show(error);
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function handleUpload() {
    if (!user || !profile || !file || !chapter.trim() || !title.trim() || !finalSubject) return;
    setPosting(true);
    try {
      const url = await uploadStudyImage(file, user.uid);
      await addStudyMaterial({
        classId: activeClass,
        subject: finalSubject,
        chapter: chapter.trim(),
        title: title.trim(),
        description: description.trim().slice(0, 240) || undefined,
        kind,
        imageUrl: url,
        uploaderId: user.uid,
        uploaderName: profile.displayName,
        uploaderAvatar: profile.avatarUrl,
      });
      show('Study resource shared!');
      reset();
      onClose();
    } catch (error) {
      show(error instanceof Error ? error.message : "Couldn't upload. Try again.");
      setPosting(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={`Add to ${activeClass} Study Help`}>
      <div className="space-y-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            chooseFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {!preview ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-9 text-ink-soft hover:border-accent hover:text-accent"
          >
            <ImagePlus size={26} />
            <span className="text-sm font-medium">Choose a clear image</span>
            <span className="px-5 text-center text-xs">Notes, formulas, mind maps, diagrams or question papers</span>
          </button>
        ) : (
          <div>
            <img src={preview} alt="Selected study resource" className="max-h-56 w-full rounded-2xl bg-surface-alt object-contain" />
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-full border border-line py-2 text-sm text-ink-soft">
              Change image
            </button>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Resource type</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STUDY_KIND_ORDER.map((value) => {
              const meta = STUDY_KIND_META[value];
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setKind(value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
                    kind === value ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
                  }`}
                >
                  {meta.emoji} {meta.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Subject</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SUBJECTS.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSubject(item.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  subject === item.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
                }`}
              >
                {item.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSubject('__custom')}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                subject === '__custom' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
              }`}
            >
              Other
            </button>
          </div>
          {subject === '__custom' && (
            <input
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Subject name"
              maxLength={40}
              className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Chapter</label>
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Chapter 5"
              maxLength={60}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Photosynthesis map"
              maxLength={120}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">What does it cover? (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description helps others find it"
            maxLength={240}
            rows={2}
            className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <p className="mt-1 text-right text-[11px] text-ink-soft">{description.length}/240</p>
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={posting || !file || !chapter.trim() || !title.trim() || !finalSubject}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {posting ? 'Uploading…' : 'Share resource'}
        </button>
      </div>
    </Modal>
  );
}
