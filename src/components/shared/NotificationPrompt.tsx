import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  PROMPT_DELAY_MS,
  PROMPT_STORAGE_KEY,
  parsePromptRecord,
  readPermission,
  shouldAskForPermission,
} from '../../utils/notificationPermission';

function recordAsk() {
  try {
    const previous = parsePromptRecord(localStorage.getItem(PROMPT_STORAGE_KEY));
    localStorage.setItem(
      PROMPT_STORAGE_KEY,
      JSON.stringify({ asks: previous.asks + 1, lastAskedAt: Date.now() })
    );
  } catch {
    // Private browsing can refuse storage; showing the prompt again later is
    // a far better failure than crashing here.
  }
}

/**
 * Explains what notifications are for BEFORE handing over to Chrome's own
 * permission dialog.
 *
 * Chrome owns the permission. This component deliberately contains no fake
 * native permission code -- all it does is explain, then call
 * Notification.requestPermission() from a real user gesture. That one call is
 * the only chance the app gets, which is why shouldAskForPermission() is so
 * conservative about when it is spent.
 */
export default function NotificationPrompt() {
  const { user, profile } = useAuth();
  const [show, setShow] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;

    const decision = shouldAskForPermission({
      permission: readPermission(),
      onboarded: profile.onboarded !== false,
      record: parsePromptRecord(
        (() => {
          try { return localStorage.getItem(PROMPT_STORAGE_KEY); } catch { return null; }
        })()
      ),
      nowMs: Date.now(),
    });

    if (!decision.show) return;

    const timer = window.setTimeout(() => setShow(true), PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [user, profile]);

  async function enable() {
    if (working) return;
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted' && user) {
        const { initPush } = await import('../../firebase/push');
        await initPush(user.uid);
      }
    } catch {
      // Nothing useful to say; Settings shows the real state either way.
    } finally {
      recordAsk();
      setWorking(false);
      setShow(false);
    }
  }

  function notNow() {
    recordAsk();
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[190] mx-auto max-w-md rounded-2xl border border-line bg-surface p-3.5 shadow-xl"
      role="dialog"
      aria-labelledby="notification-prompt-title"
      aria-describedby="notification-prompt-body"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Bell size={18} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p id="notification-prompt-title" className="text-sm font-semibold text-ink">
            Turn on notifications?
          </p>
          <p id="notification-prompt-body" className="mt-0.5 text-xs leading-5 text-ink-soft">
            So you hear about homework, replies and calls while Buddy Planner is closed.
            You choose which kinds in Settings, and Quiet Hours still applies.
          </p>

          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enable}
              disabled={working}
              className="min-h-10 rounded-full bg-accent px-4 text-xs font-semibold text-white disabled:opacity-60"
            >
              {working ? 'Just a moment…' : 'Turn on'}
            </button>
            <button
              type="button"
              onClick={notNow}
              className="min-h-10 rounded-full px-3 text-xs font-medium text-ink-soft"
            >
              Not now
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={notNow}
          aria-label="Dismiss"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
