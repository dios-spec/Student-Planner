import { useState } from 'react';
import Modal from '../shared/Modal';
import { addAnnouncement } from '../../firebase/announcements';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useActiveClass } from '../../context/ClassContext';

export default function AnnouncementComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { activeClass } = useActiveClass();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [forDate, setForDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile || !title.trim()) return;
    setSaving(true);
    try {
      await addAnnouncement(activeClass, title.trim(), body.trim(), forDate || undefined, user.uid, profile.displayName);
      show('Announcement posted');
      setTitle('');
      setBody('');
      setForDate('');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Announcement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bring sports uniform"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Details (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
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
          {saving ? 'Posting…' : 'Post Announcement'}
        </button>
      </form>
    </Modal>
  );
}
