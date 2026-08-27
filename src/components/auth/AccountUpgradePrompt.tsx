import { useEffect, useState } from 'react';
import { Cloud, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const SHOW_AFTER_MS = 6000;

function friendlyError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (code === 'auth/popup-closed-by-user') return '';
  if (code === 'auth/popup-blocked') {
    return 'Google sign-in was blocked. Allow the sign-in window and try again.';
  }
  if (
    code === 'auth/credential-already-in-use' ||
    code === 'auth/email-already-in-use' ||
    code === 'auth/account-exists-with-different-credential'
  ) {
    return 'That sign-in is already connected to a different Buddy Planner profile. Use another account so neither profile is overwritten.';
  }
  if (code === 'auth/invalid-email') {
    return 'Enter a valid email address.';
  }
  if (code === 'auth/weak-password') {
    return 'Choose a password with at least 6 characters.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled in Firebase yet.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network problem. Check your connection and try again.';
  }

  return error instanceof Error
    ? error.message
    : 'Could not connect Google right now. Try again.';
}

export default function AccountUpgradePrompt() {
  const { user, accountType, linkGoogleAccount, linkEmailAccount } = useAuth();
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || accountType !== 'anonymous') {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [user?.uid, accountType]);

  if (!user || accountType !== 'anonymous' || !visible) return null;

  async function connectGoogle() {
    if (working) return;
    setWorking(true);
    setError('');

    try {
      await linkGoogleAccount();
      setVisible(false);
    } catch (err) {
      const message = friendlyError(err);
      if (message) setError(message);
    } finally {
      setWorking(false);
    }
  }

  async function connectEmail() {
    if (working) return;

    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setWorking(true);
    setError('');

    try {
      await linkEmailAccount(email, password);
      setVisible(false);
    } catch (err) {
      const message = friendlyError(err);
      if (message) setError(message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[240] flex items-end justify-center bg-black/35 p-3 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-upgrade-title"
      aria-describedby="account-upgrade-description"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-surface shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-accent-soft via-surface to-surface" />

        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Close account reminder"
          className="absolute right-3 top-3 z-10 rounded-full border border-line bg-surface/90 p-2 text-ink-soft"
        >
          <X size={17} />
        </button>

        <div className="relative p-5 pt-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-xl font-black text-white shadow-sm">
              G
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
                Protect your profile
              </p>
              <h2 id="account-upgrade-title" className="font-display text-xl font-bold text-ink">
                Secure Buddy Planner with Google
              </h2>
            </div>
          </div>

          <p id="account-upgrade-description" className="text-sm leading-6 text-ink-soft">
            You're using an anonymous account right now. Connect Google or Email/Password
            so the same Buddy Planner profile can be recovered on another device or after reinstalling.
          </p>

          <div className="mt-4 grid gap-2">
            <div className="flex items-start gap-2 rounded-2xl bg-surface-alt p-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">Your Buddy data stays the same</p>
                <p className="text-xs leading-5 text-ink-soft">
                  Your Firebase UID, profile, chats, merits and existing data are kept.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-2xl bg-surface-alt p-3">
              <Cloud size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">Recovery on another device</p>
                <p className="text-xs leading-5 text-ink-soft">
                  Google becomes the recovery sign-in. Buddy Planner never displays your Google email publicly.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p
              className="mt-3 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-xs font-medium text-danger"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={connectGoogle}
            disabled={working}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-accent">
              G
            </span>
            {working ? 'Connecting…' : 'Continue with Google'}
          </button>

          <button
            type="button"
            onClick={() => {
              setEmailMode((value) => !value);
              setError('');
            }}
            disabled={working}
            className="mt-2 w-full rounded-2xl border border-line bg-surface-alt px-4 py-3 text-sm font-bold text-ink disabled:opacity-50"
          >
            {emailMode ? 'Hide email option' : 'Use Email & Password instead'}
          </button>

          {emailMode && (
            <div className="mt-3 space-y-2 rounded-2xl border border-line bg-surface-alt p-3">
              <label className="block text-xs font-semibold text-ink">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="your@email.com"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
              </label>

              <label className="block text-xs font-semibold text-ink">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
              </label>

              <button
                type="button"
                onClick={connectEmail}
                disabled={working}
                className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-surface disabled:opacity-50"
              >
                {working ? 'Connecting…' : 'Secure with Email'}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setVisible(false)}
            disabled={working}
            className="mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-ink-soft disabled:opacity-50"
          >
            Maybe later
          </button>

          <p className="mt-1 text-center text-2xs leading-4 text-ink-soft">
            If you choose Maybe later, this reminder can appear again the next time Buddy Planner starts.
          </p>
        </div>
      </div>
    </div>
  );
}
