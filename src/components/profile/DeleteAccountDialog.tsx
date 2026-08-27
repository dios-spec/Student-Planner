import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../shared/Modal';
import { useAuth } from '../../context/AuthContext';
import { deleteMyAccount } from '../../firebase/accountDeletion';

const CONFIRM_WORD = 'DELETE';

/**
 * Deliberately high-friction. Deleting an account is irreversible, so this
 * spells out what goes and what stays, and requires the person to type the
 * word rather than tap a red button by accident.
 */
export default function DeleteAccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) { setTyped(''); setError(''); setWorking(false); setDone(false); }
  }, [open]);

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;

  async function confirmDelete() {
    if (!armed || working || !user) return;
    setWorking(true);
    setError('');
    try {
      await deleteMyAccount(user);
      setDone(true);
      // Reload into a clean, signed-out app rather than leaving dead state on screen.
      window.setTimeout(() => window.location.replace('/'), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your account could not be deleted.');
      setWorking(false);
    }
  }

  return (
    <Modal open={open} onClose={working ? () => {} : onClose} title="Delete your account">
      {done ? (
        <div className="py-6 text-center">
          <p className="font-display text-lg font-semibold text-ink">Your account has been deleted</p>
          <p className="mt-1 text-sm text-ink-soft">Taking you back to the start…</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl bg-coral-soft p-3.5">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-coral" aria-hidden="true" />
            <p className="text-sm leading-6 text-ink">
              This cannot be undone. Your profile, posts, stories, reels, comments, saved items,
              notes, reminders and notifications are deleted straight away.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface-alt p-3.5">
            <p className="text-sm font-semibold text-ink">What stays</p>
            <ul className="mt-1.5 space-y-1 text-xs leading-5 text-ink-soft">
              <li>Messages you sent stay in other people's chats, but emptied and shown as "Deleted user".</li>
              <li>Homework and exams you added stay for the rest of your class.</li>
              <li>Merit and demerit records are kept by the school.</li>
            </ul>
          </div>

          <div>
            <label htmlFor="delete-confirm" className="mb-1.5 block text-sm font-semibold text-ink">
              Type {CONFIRM_WORD} to confirm
            </label>
            <input
              id="delete-confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!error}
              aria-describedby={error ? 'delete-error' : undefined}
              className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm tracking-widest text-ink outline-none focus:border-coral"
            />
            {error && (
              <p id="delete-error" role="alert" className="mt-2 text-sm font-medium text-coral">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="min-h-11 flex-1 rounded-full border border-line px-4 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Keep my account
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={!armed || working}
              className="min-h-11 flex-1 rounded-full bg-coral px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {working ? 'Deleting…' : 'Delete for ever'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
