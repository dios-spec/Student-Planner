import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import { DEFAULT_SUBJECTS } from '../../data/subjects';
import { CATEGORY_ORDER, CATEGORY_META } from '../../data/categories';
import type { PlannerCategory, PlannerItem } from '../../types';
import { addPlannerItem, updatePlannerItem } from '../../firebase/planner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MAX_TASK_DESC_LENGTH, MAX_TASK_TITLE_LENGTH } from '../../utils/moderation';

interface AddTaskSheetProps {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  editingItem?: PlannerItem | null;
}

export default function AddTaskSheet({ open, onClose, dateKey, editingItem }: AddTaskSheetProps) {
  const { user, profile } = useAuth();
  const { show } = useToast();

  const [subject, setSubject] = useState('maths');
  const [customSubject, setCustomSubject] = useState('');
  const [category, setCategory] = useState<PlannerCategory>('writing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [portion, setPortion] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setSubject(editingItem.subject);
      setCategory(editingItem.category);
      setTitle(editingItem.title);
      setDescription(editingItem.description || '');
      setDueDate(editingItem.dueDate || '');
      setPortion(editingItem.portion || '');
      setNote(editingItem.note || '');
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
    }
  }, [open, editingItem]);

  const finalSubject = subject === '__custom' ? customSubject.trim().toLowerCase().replace(/\s+/g, '-') : subject;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile || !title.trim() || !finalSubject) return;
    setSaving(true);
    try {
      const payload = {
        date: dateKey,
        subject: finalSubject,
        category,
        title: title.trim().slice(0, MAX_TASK_TITLE_LENGTH),
        description: description.trim().slice(0, MAX_TASK_DESC_LENGTH) || undefined,
        dueDate: dueDate || undefined,
        portion: portion.trim() || undefined,
        note: note.trim() || undefined,
      };
      if (editingItem) {
        await updatePlannerItem(editingItem.id, payload, user.uid, profile.displayName);
        show('Task updated');
      } else {
        await addPlannerItem(payload, user.uid, profile.displayName);
        show('Task added');
      }
      onClose();
    } catch {
      show("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const needsDueDate = category === 'test' || category === 'project';

  return (
    <Modal open={open} onClose={onClose} title={editingItem ? 'Edit Task' : 'Add Task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={saving || !title.trim() || (subject === '__custom' && !customSubject.trim())}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add'}
        </button>
      </form>
    </Modal>
  );
}
