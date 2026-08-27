import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Check } from 'lucide-react';
import { readPermission, type PermissionState } from '../utils/notificationPermission';
import { useAuth } from '../context/AuthContext';
import { updateNotificationSettings } from '../firebase/users';
import type { NotificationSettings, QuietHours } from '../types';

const DEFAULT_QUIET: QuietHours = { enabled: false, start: '22:30', end: '06:30', allowCalls: true, allowUrgent: true };

const SECTIONS: { title: string; rows: { key: keyof NotificationSettings; label: string }[] }[] = [
  {
    title: 'Messages',
    rows: [
      { key: 'dm', label: 'Direct messages' },
      { key: 'groupMessage', label: 'Group messages' },
      { key: 'classMessage', label: 'Class chat' },
      { key: 'reply', label: 'Replies' },
      { key: 'comment', label: 'Comments (posts, reels, stories)' },
    ],
  },
  {
    title: 'Social',
    rows: [
      { key: 'postLike', label: 'Post likes' },
      { key: 'reelLike', label: 'Reel likes' },
      { key: 'storyLike', label: 'Story likes' },
    ],
  },
  {
    title: 'Calls',
    rows: [
      { key: 'calls', label: 'Incoming calls' },
      { key: 'missedCall', label: 'Missed calls' },
    ],
  },
  {
    title: 'School',
    rows: [
      { key: 'homework', label: 'Homework' },
      { key: 'exam', label: 'Tests / exams' },
      { key: 'announcement', label: 'Announcements' },
      { key: 'studyHelp', label: 'Study Help' },
      { key: 'groupEvents', label: 'Group changes (added, promoted, etc.)' },
    ],
  },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={(checked ? 'bg-accent' : 'bg-line') + ' relative h-6 w-11 shrink-0 rounded-full transition-colors'}
    >
      <span className={(checked ? 'translate-x-5' : 'translate-x-0') + ' absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform'} />
    </button>
  );
}

/**
 * Device-level permission state and, when it is blocked, the only route back.
 *
 * Chrome owns this permission: once it is denied, requestPermission() silently
 * resolves 'denied' without showing anything, so a button here would be a lie.
 * The honest thing is to say what happened and where the real switch lives.
 */
function DevicePermission({ uid }: { uid: string | undefined }) {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setPermission(readPermission());
    // Permission can be changed from browser UI while the app is open.
    const onFocus = () => setPermission(readPermission());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function turnOn() {
    if (working || !uid) return;
    setWorking(true);
    try {
      const next = await Notification.requestPermission();
      setPermission(next === 'granted' ? 'granted' : next === 'denied' ? 'denied' : 'default');
      if (next === 'granted') {
        const { initPush } = await import('../firebase/push');
        await initPush(uid);
      }
    } catch {
      setPermission(readPermission());
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">This device</p>
      <div className="rounded-2xl border border-line bg-surface p-4">
        {permission === 'granted' && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <Check size={16} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Notifications are on</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                Buddy Planner can reach this device even when it is closed. The switches below
                decide what is worth sending.
              </p>
            </div>
          </div>
        )}

        {permission === 'default' && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bell size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Notifications are off</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                Without them you only see homework, replies and calls when the app is open.
              </p>
              <button
                type="button"
                onClick={turnOn}
                disabled={working}
                className="mt-2.5 min-h-10 rounded-full bg-accent px-4 text-xs font-semibold text-white disabled:opacity-60"
              >
                {working ? 'Just a moment…' : 'Turn on notifications'}
              </button>
            </div>
          </div>
        )}

        {permission === 'denied' && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral">
              <BellOff size={16} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Blocked by your browser</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                Buddy Planner cannot ask again from here — the browser remembers the block.
                To undo it:
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-ink-soft">
                <li>
                  <span className="font-semibold text-ink">Installed app:</span> press and hold the
                  Buddy Planner icon, open App info, then Notifications, and allow them.
                </li>
                <li>
                  <span className="font-semibold text-ink">Chrome tab:</span> tap the icon to the
                  left of the address bar, open Permissions, then allow Notifications.
                </li>
              </ul>
              <p className="mt-2 text-xs leading-5 text-ink-soft">
                Come back to this screen afterwards and it will say Notifications are on.
              </p>
            </div>
          </div>
        )}

        {permission === 'unsupported' && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-alt text-ink-soft">
              <BellOff size={16} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Not supported here</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                This browser cannot show notifications. Buddy Planner still records everything in
                the Notification Centre.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const settings = profile?.notificationSettings || {};
  const quiet = settings.quietHours || DEFAULT_QUIET;

  function setField(key: keyof NotificationSettings, value: boolean) {
    if (!user) return;
    updateNotificationSettings(user.uid, { [key]: value });
  }

  function setQuiet(patch: Partial<QuietHours>) {
    if (!user) return;
    updateNotificationSettings(user.uid, { quietHours: { ...quiet, ...patch } });
  }

  if (!profile) return null;

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/95 px-2 py-3 pt-[env(safe-area-inset-top)] backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
          <ArrowLeft size={20} />
        </button>
        <p className="font-display text-lg font-semibold text-ink">Notification Settings</p>
      </header>

      <div className="space-y-5 px-4 pt-4">
        <DevicePermission uid={user?.uid} />

        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{section.title}</p>
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {section.rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-ink">{row.label}</span>
                  <Toggle
                    checked={settings[row.key] !== false}
                    onChange={(v) => setField(row.key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Sound & Vibration</p>
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm text-ink">Call ringtone</p>
                <p className="text-xs text-ink-soft">Sound and vibration for incoming calls</p>
              </div>
              <Toggle checked={settings.sound !== false} onChange={(v) => setField('sound', v)} />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Quiet Hours</p>
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">Enable Quiet Hours</span>
              <Toggle checked={!!quiet.enabled} onChange={(v) => setQuiet({ enabled: v })} />
            </div>

            {quiet.enabled && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-ink-soft">From</label>
                    <input
              aria-label="From"
                      type="time"
                      value={quiet.start}
                      onChange={(e) => setQuiet({ start: e.target.value })}
                      className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-ink-soft">To</label>
                    <input
              aria-label="To"
                      type="time"
                      value={quiet.end}
                      onChange={(e) => setQuiet({ end: e.target.value })}
                      className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={quiet.allowCalls}
                    onChange={(e) => setQuiet({ allowCalls: e.target.checked })}
                    className="h-4 w-4 rounded border-line accent-accent"
                  />
                  Allow calls during Quiet Hours
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={quiet.allowUrgent}
                    onChange={(e) => setQuiet({ allowUrgent: e.target.checked })}
                    className="h-4 w-4 rounded border-line accent-accent"
                  />
                  Allow urgent school alerts (homework, tests, announcements)
                </label>
                <p className="text-xs text-ink-soft">
                  Uses your device's timezone. The Notification Center still records everything
                  even when push is silenced.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
