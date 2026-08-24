import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import TeacherClassTarget from '../layout/TeacherClassTarget';
import { addAnnouncement } from '../../firebase/announcements';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useActiveClass } from '../../context/ClassContext';
import type { ClassId } from '../../data/classes';

export default function AnnouncementComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile, isTeacher } = useAuth();
  const { show } = useToast();
  const { activeClass } = useActiveClass();
  const [targetClass, setTargetClass] = useState<ClassId>(activeClass);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [forDate, setForDate] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isTeacher) return null;

  useEffect(() => {
    if (open) setTargetClass(activeClass);
  }, [open, activeClass]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile || !isTeacher || !title.trim()) return;

    setSaving(true);
    try {
      const destinationClass = isTeacher ? targetClass : activeClass;
      await addAnnouncement(
        destinationClass,
        title.trim(),
        body.trim(),
        forDate || undefined,
        user.uid,
        profile.displayName
      );
      show(`Announcement posted to ${destinationClass}`);
      setTitle('');
      setBody('');
      setForDate('');
      onClose();
    } catch {
      show("Couldn't post announcement. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Announcement">
      <form onSubmit={handleSubmit} className="space-y-4">
        {isTeacher && (
          <TeacherClassTarget
            value={targetClass}
            onChange={setTargetClass}
            label="Send announcement to"
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bring sports uniform"
            maxLength={120}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Details (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 400))}
            rows={2}
            className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">For date (optional)</label>
          <input
            type="date"
            value={forDate}
            onChange={(e) => setForDate(e.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Posting...' : isTeacher ? `Post to ${targetClass}` : 'Post Announcement'}
        </button>
      </form>
    </Modal>
  );
}
