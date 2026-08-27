import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import type { TimetablePeriod } from '../../types';

interface AddPeriodSheetProps {
  open: boolean;
  onClose: () => void;
  editingPeriod: TimetablePeriod | null;
  existingPeriodNumbers: number[];
  onSave: (period: TimetablePeriod) => void | Promise<void>;
}

export default function AddPeriodSheet({ open, onClose, editingPeriod, existingPeriodNumbers, onSave }: AddPeriodSheetProps) {
  const [periodNum, setPeriodNum] = useState(1);
  const [subject, setSubject] = useState('');
  const [teacher, setTeacher] = useState('');
  const [room, setRoom] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingPeriod) {
      setPeriodNum(editingPeriod.period);
      setSubject(editingPeriod.subject);
      setTeacher(editingPeriod.teacher || '');
      setRoom(editingPeriod.room || '');
    } else {
      const next = existingPeriodNumbers.length > 0 ? Math.max(...existingPeriodNumbers) + 1 : 1;
      setPeriodNum(next);
      setSubject('');
      setTeacher('');
      setRoom('');
    }
  }, [open, editingPeriod, existingPeriodNumbers]);

  async function handleSave() {
    if (!subject.trim()) return;
    setSaving(true);
    try {
      await onSave({
        period: periodNum,
        subject: subject.trim().slice(0, 60),
        teacher: teacher.trim() || undefined,
        room: room.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editingPeriod ? 'Edit Period' : 'Add Period'}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Period number</label>
          <input
              aria-label="Period number"
            type="number"
            min={1}
            max={12}
            value={periodNum}
            onChange={(e) => setPeriodNum(Number(e.target.value) || 1)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Subject</label>
          <input
              aria-label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Mathematics"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Teacher (optional)</label>
          <input
              aria-label="Teacher (optional)"
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            placeholder="e.g. Mr. Sharma"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Room (optional)</label>
          <input
              aria-label="Room (optional)"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="e.g. Room 204"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !subject.trim()}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
