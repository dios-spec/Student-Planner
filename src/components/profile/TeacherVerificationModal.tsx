import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import Modal from '../shared/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { TeacherVerificationError } from '../../firebase/teacherVerification';

export default function TeacherVerificationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isTeacher, claimsLoading, verifyTeacher } = useAuth();
  const { show } = useToast();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setShowPassword(false);
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      await verifyTeacher(password);
      setPassword('');
      show('Teacher access verified');
      onClose();
    } catch (caught) {
      setPassword('');
      setError(
        caught instanceof TeacherVerificationError
          ? caught.message
          : 'Teacher verification failed. Try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title="Verify teacher access">
      {isTeacher ? (
        <div className="flex flex-col items-center gap-3 py-5 text-center">
          <span className="rounded-full bg-success-soft p-4 text-success">
            <ShieldCheck size={30} aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">Teacher verified</p>
            <p className="mt-1 text-sm text-ink-soft">Your secure teacher role is active on this account.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3 rounded-2xl bg-accent-soft p-3.5">
            <LockKeyhole size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <p className="text-sm text-ink">
              Enter the school teacher password. It is checked securely on the server and is never saved in
              your profile or app storage.
            </p>
          </div>

          <div>
            <label htmlFor="teacher-verification-password" className="mb-1.5 block text-sm font-semibold text-ink">
              Teacher password
            </label>
            <div className="relative">
              <input
                id="teacher-verification-password"
                autoFocus
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                maxLength={256}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!error}
                aria-describedby={error ? 'teacher-verification-error' : 'teacher-verification-help'}
                className="w-full rounded-xl border border-line bg-paper px-3 py-3 pr-11 text-sm text-ink outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-soft"
                aria-label={showPassword ? 'Hide teacher password' : 'Show teacher password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p id="teacher-verification-help" className="mt-1.5 text-xs text-ink-soft">
              Only staff who received the password from the school should continue.
            </p>
            {error && (
              <p id="teacher-verification-error" className="mt-2 text-sm font-medium text-coral" role="alert">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!password || submitting || claimsLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <ShieldCheck size={17} aria-hidden="true" />
            {submitting || claimsLoading ? 'Verifying securely…' : 'Verify teacher access'}
          </button>
        </form>
      )}
    </Modal>
  );
}
