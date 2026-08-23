import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import Avatar from '../shared/Avatar';
import { addMeritRecord } from '../../firebase/merits';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { isClassId } from '../../data/classes';
import type { MeritKind, StudentProfile } from '../../types';

export default function AwardMeritModal({
  student,
  initialKind,
  onClose,
}: {
  student: StudentProfile | null;
  initialKind: MeritKind;
  onClose: () => void;
}) {
  const { user, isTeacher } = useAuth();
  const { show } = useToast();
  const [kind, setKind] = useState<MeritKind>(initialKind);
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!student) return;
    setKind(initialKind);
    setPoints(1);
    setReason('');
  }, [student, initialKind]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!student || !user || !isTeacher || !isClassId(student.classId) || !reason.trim()) return;

    setSaving(true);
    try {
      await addMeritRecord({
        studentId: student.id,
        teacherId: user.uid,
        classId: student.classId,
        kind,
        points,
        reason,
      });
      show(`${kind === 'merit' ? 'Merit' : 'Demerit'} added`);
      onClose();
    } catch {
      show("Couldn't save Merit/Demerit. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!student} onClose={() => !saving && onClose()} title="Add Merit / Demerit">
      {student && (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-alt p-3">
            <Avatar name={student.displayName} src={student.avatarUrl} emoji={student.emoji} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{student.displayName}</p>
              <p className="text-xs text-ink-soft">Class {student.classId || 'not set'}</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('merit')}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                  kind === 'merit' ? 'border-success bg-success-soft text-success' : 'border-line text-ink-soft'
                }`}
              >
                + Merit
              </button>
              <button
                type="button"
                onClick={() => setKind('demerit')}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                  kind === 'demerit' ? 'border-coral bg-coral-soft text-coral' : 'border-line text-ink-soft'
                }`}
              >
                - Demerit
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="merit-points" className="mb-1.5 block text-sm font-semibold text-ink">Points</label>
            <input
              id="merit-points"
              type="number"
              min={1}
              max={10}
              value={points}
              onChange={(event) => setPoints(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="merit-reason" className="mb-1.5 block text-sm font-semibold text-ink">Reason</label>
            <textarea
              id="merit-reason"
              required
              maxLength={160}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={kind === 'merit' ? 'e.g. Excellent class participation' : 'e.g. Repeatedly missing required work'}
              className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-right text-[11px] text-ink-soft">{reason.length}/160</p>
          </div>

          <p className="rounded-xl bg-surface-alt p-3 text-xs text-ink-soft">
            Changes appear live. If a genuine mistake needs manual correction, the project owner can edit or delete the record in Firebase Console.
          </p>

          <button
            type="submit"
            disabled={saving || !reason.trim() || !isClassId(student.classId)}
            className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 ${
              kind === 'merit' ? 'bg-success' : 'bg-coral'
            }`}
          >
            {saving ? 'Saving...' : kind === 'merit' ? `Give +${points} Merit` : `Give -${points} Demerit`}
          </button>
        </form>
      )}
    </Modal>
  );
}
