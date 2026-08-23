import { useEffect, useRef, useState } from 'react';
import { Bell, ImagePlus, X } from 'lucide-react';
import Modal from '../shared/Modal';
import RemindMeSheet from './RemindMeSheet';
import { DEFAULT_SUBJECTS } from '../../data/subjects';
import { CATEGORY_ORDER, CATEGORY_META } from '../../data/categories';
import type { PlannerAttachment, PlannerCategory, PlannerItem } from '../../types';
import { addPlannerItem, updatePlannerItem } from '../../firebase/planner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useActiveClass } from '../../context/ClassContext';
import { MAX_TASK_DESC_LENGTH, MAX_TASK_TITLE_LENGTH } from '../../utils/moderation';
import { uploadPlannerAttachment } from '../../firebase/storage';
import { validateImageFile } from '../../utils/image';

const MAX_ATTACHMENTS = 4;

interface AttachmentDraft {
  file: File;
  previewUrl: string;
}

interface AddTaskSheetProps {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  editingItem?: PlannerItem | null;
}

export default function AddTaskSheet({ open, onClose, dateKey, editingItem }: AddTaskSheetProps) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { activeClass } = useActiveClass();

  const [subject, setSubject] = useState('maths');
  const [customSubject, setCustomSubject] = useState('');
  const [category, setCategory] = useState<PlannerCategory>('writing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [portion, setPortion] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<PlannerAttachment[]>([]);
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  function clearAttachmentDrafts() {
    setAttachmentDrafts((current) => {
      current.forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
      return [];
    });
  }

  useEffect(() => {
    if (!open) return;
    clearAttachmentDrafts();
    if (editingItem) {
      setSubject(editingItem.subject);
      setCategory(editingItem.category);
      setTitle(editingItem.title);
      setDescription(editingItem.description || '');
      setDueDate(editingItem.dueDate || '');
      setPortion(editingItem.portion || '');
      setNote(editingItem.note || '');
      setExistingAttachments(editingItem.attachments || []);
      setCustomSubject('');
    } else {
      setSubject('maths');
      setCustomSubject('');
      setCategory('writing');
      setTitle('');
      setDescription('');
      setDueDate('');
      setPortion('');
      setNote('');
      setExistingAttachments([]);
    }
  }, [open, editingItem]);

  const finalSubject = subject === '__custom' ? customSubject.trim().toLowerCase().replace(/\s+/g, '-') : subject;

  function chooseAttachments(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_ATTACHMENTS - existingAttachments.length - attachmentDrafts.length;
    if (room <= 0) {
      show(`You can attach up to ${MAX_ATTACHMENTS} images.`);
      return;
    }

    const selected = Array.from(files);
    const next: AttachmentDraft[] = [];
    selected.slice(0, room).forEach((file) => {
      const error = validateImageFile(file);
      if (error) {
        show(`${file.name}: ${error}`);
        return;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    });
    if (selected.length > room) show(`Only ${MAX_ATTACHMENTS} images can be attached.`);
    setAttachmentDrafts((current) => [...current, ...next]);
  }

  function removeDraft(index: number) {
    setAttachmentDrafts((current) => current.filter((draft, draftIndex) => {
      if (draftIndex === index) URL.revokeObjectURL(draft.previewUrl);
      return draftIndex !== index;
    }));
  }

  function handleClose() {
    if (saving) return;
    clearAttachmentDrafts();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile || !title.trim() || !finalSubject) return;
    setSaving(true);
    try {
      const uploadedAttachments = await Promise.all(
        attachmentDrafts.map(async ({ file }) => ({
          url: await uploadPlannerAttachment(file, user.uid),
          name: file.name.slice(0, 120),
        }))
      );
      const payload = {
        classId: editingItem?.classId || activeClass,
        date: dateKey,
        subject: finalSubject,
        category,
        title: title.trim().slice(0, MAX_TASK_TITLE_LENGTH),
        description: description.trim().slice(0, MAX_TASK_DESC_LENGTH) || undefined,
        dueDate: dueDate || undefined,
        portion: portion.trim() || undefined,
        note: note.trim() || undefined,
        attachments: [...existingAttachments, ...uploadedAttachments],
      };
      if (editingItem) {
        await updatePlannerItem(editingItem.id, payload, user.uid, profile.displayName);
        show('Task updated');
      } else {
        await addPlannerItem(payload, user.uid, profile.displayName);
        show('Task added');
      }
      clearAttachmentDrafts();
      onClose();
    } catch {
      show("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const needsDueDate = category === 'test' || category === 'project';

  return (
    <Modal open={open} onClose={handleClose} title={editingItem ? 'Edit Task' : 'Add Task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          ref={attachmentInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event) => {
            chooseAttachments(event.target.files);
            event.target.value = '';
          }}
        />
        {editingItem && (
          <button
            type="button"
            onClick={() => setRemindOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-accent"
          >
            <Bell size={16} /> Remind me about this
          </button>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Subject</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SUBJECTS.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setSubject(s.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  subject === s.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
                }`}
              >
                {s.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSubject('__custom')}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
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
              className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            />
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Type</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  category === c ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
                }`}
              >
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Description</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Complete Exercise 6.3"
            maxLength={MAX_TASK_TITLE_LENGTH}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        {category === 'test' && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Portion / Syllabus</label>
            <input
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
              placeholder="e.g. Chapters 3–4"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
        )}

        {needsDueDate && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">
              {category === 'test' ? 'Test date' : 'Due date'}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Any extra detail"
            className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        {(category === 'project' || category === 'important') && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Shared note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bring cardboard + colours"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-ink">Attachments (optional)</label>
            <span className="text-xs text-ink-soft">{existingAttachments.length + attachmentDrafts.length}/{MAX_ATTACHMENTS}</span>
          </div>

          {(existingAttachments.length > 0 || attachmentDrafts.length > 0) && (
            <div className="mb-2 grid grid-cols-4 gap-2">
              {existingAttachments.map((attachment, index) => (
                <div key={`${attachment.url}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-alt">
                  <img src={attachment.url} alt={attachment.name || `Attachment ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setExistingAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remove ${attachment.name || `attachment ${index + 1}`}`}
                    className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {attachmentDrafts.map((draft, index) => (
                <div key={`${draft.file.name}-${draft.file.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-alt">
                  <img src={draft.previewUrl} alt={draft.file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeDraft(index)}
                    aria-label={`Remove ${draft.file.name}`}
                    className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={existingAttachments.length + attachmentDrafts.length >= MAX_ATTACHMENTS}
            onClick={() => attachmentInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-2.5 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ImagePlus size={17} /> Add images
          </button>
          <p className="mt-1.5 text-xs text-ink-soft">Up to 4 images. They are compressed before upload.</p>
        </div>

        <button
          type="submit"
          disabled={saving || !title.trim() || (subject === '__custom' && !customSubject.trim())}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add'}
        </button>
      </form>

      <RemindMeSheet open={remindOpen} onClose={() => setRemindOpen(false)} item={editingItem || null} />
    </Modal>
  );
}
