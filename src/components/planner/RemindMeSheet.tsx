import { useState } from 'react';
import Modal from '../shared/Modal';
import { createReminder } from '../../firebase/reminders';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fromDateKey } from '../../utils/date';
import type { PlannerItem } from '../../types';

interface RemindMeSheetProps {
  open: boolean;
  onClose: () => void;
  item: PlannerItem | null;
}

export default function RemindMeSheet({ open, onClose, item }: RemindMeSheetProps) {
  const { user } = useAuth();
  const { show } = useToast();
  const [customValue, setCustomValue] = useState('');
  const [saving, setSaving] = useState(false);

  if (!item) return null;
  const targetDay = item.dueDate || item.date;

  async function save(remindAt: Date, label: string) {
    if (!user || !item) return;
    setSaving(true);
    try {
      await createReminder({ userId: user.uid, itemId: item.id, itemTitle: item.title, remindAt });
      show('Reminder set for ' + label);
      onClose();
    } catch {
      show("Couldn't set reminder. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function inOneHour() {
    save(new Date(Date.now() + 60 * 60 * 1000), 'in 1 hour');
  }

  function tonight() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(20, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    save(target, 'tonight');
  }

  function morningOf() {
    const base = fromDateKey(targetDay);
    base.setHours(7, 0, 0, 0);
    if (base.getTime() <= Date.now()) {
      show('That morning has already passed -- try a custom time instead.');
      return;
    }
    save(base, "the morning it's due");
  }

  function useCustom() {
    if (!customValue) return;
    const d = new Date(customValue);
    if (isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      show('Pick a time in the future.');
      return;
    }
    save(d, 'your chosen time');
  }

  return (
    <Modal open={open} onClose={onClose} title="Remind me">
      <div className="space-y-2.5">
        <p className="text-sm text-ink-soft">"{item.title}"</p>
        <button onClick={inOneHour} disabled={saving} className="w-full rounded-xl border border-line px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-alt">
          In 1 hour
        </button>
        <button onClick={tonight} disabled={saving} className="w-full rounded-xl border border-line px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-alt">
          Tonight (8 PM)
        </button>
        <button onClick={morningOf} disabled={saving} className="w-full rounded-xl border border-line px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-alt">
          The morning it's due (7 AM)
        </button>
        <div className="flex items-center gap-2 pt-1">
          <input
            aria-label="Reminder date and time"
            type="datetime-local"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button onClick={useCustom} disabled={saving || !customValue} className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            Set
          </button>
        </div>
      </div>
    </Modal>
  );
}
