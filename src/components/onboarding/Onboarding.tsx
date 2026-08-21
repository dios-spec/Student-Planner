import { useRef, useState } from 'react';
import { Camera, ArrowRight } from 'lucide-react';
import Avatar from '../shared/Avatar';
import { CLASSES, CLASS_COLORS, type ClassId } from '../../data/classes';
import { MOODS } from '../../data/moods';
import { updateUserProfile } from '../../firebase/users';
import { uploadAvatar } from '../../firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from '../../utils/moderation';

const EMOJI_OPTIONS = ['🙂', '😎', '🤓', '📚', '⚽', '🎨', '🎮', '🎵', '🦊', '🐼'];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🙂');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [bio, setBio] = useState('');
  const [classId, setClassId] = useState<ClassId | null>(null);
  const [mood, setMood] = useState<{ emoji: string; label: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file, user.uid);
      setAvatarUrl(url);
    } catch {
      show("Couldn't upload photo.");
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    if (!user || !classId) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: name.trim().slice(0, MAX_NAME_LENGTH) || (profile?.displayName ?? 'Student'),
        bio: bio.trim().slice(0, MAX_BIO_LENGTH),
        emoji,
        avatarUrl,
        classId,
        moodEmoji: mood?.emoji,
        moodLabel: mood?.label,
        onboarded: true,
      });
      localStorage.setItem('sbp_active_class', classId);
      onDone();
    } catch {
      show("Couldn't save profile. Try again.");
      setSaving(false);
    }
  }

  const canContinue =
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && !!classId) ||
    step === 2;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+2rem)]">
        {/* progress dots */}
        <div className="mb-8 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-accent' : 'w-1.5 bg-line'}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="flex flex-1 flex-col">
            <h1 className="font-display text-2xl font-bold text-ink">Welcome! 👋</h1>
            <p className="mt-1 text-sm text-ink-soft">Let's set up your profile. No email or password needed.</p>

            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar name={name || 'You'} src={avatarUrl} emoji={!avatarUrl ? emoji : undefined} size="lg" />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 rounded-full bg-accent p-2 text-white shadow"
                  aria-label="Add photo"
                >
                  <Camera size={14} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatar(f);
                    e.target.value = '';
                  }}
                />
              </div>
              {uploading && <span className="text-xs text-ink-soft">Uploading…</span>}
              {!avatarUrl && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`rounded-full border p-1.5 text-base ${emoji === e ? 'border-accent bg-accent-soft' : 'border-line'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Your name</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                placeholder="What should we call you?"
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm outline-none focus:border-accent"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Short bio (optional)</label>
              <input
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={MAX_BIO_LENGTH}
                placeholder='e.g. "Loves football ⚽"'
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h1 className="font-display text-2xl font-bold text-ink">Which class are you in?</h1>
            <p className="mt-1 text-sm text-ink-soft">You'll see your class's homework, tests and study help.</p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {CLASSES.map((c) => (
                <button
                  key={c}
                  onClick={() => setClassId(c)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 font-display text-2xl font-bold transition-all ${
                    classId === c ? 'text-white' : 'border-line text-ink-soft'
                  }`}
                  style={classId === c ? { backgroundColor: CLASS_COLORS[c], borderColor: CLASS_COLORS[c] } : undefined}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <h1 className="font-display text-2xl font-bold text-ink">Set a mood? (optional)</h1>
            <p className="mt-1 text-sm text-ink-soft">Shows a little badge on your profile. You can change it anytime.</p>
            <div className="mt-8 grid grid-cols-2 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.label}
                  onClick={() => setMood(mood?.label === m.label ? null : m)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    mood?.label === m.label ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink'
                  }`}
                >
                  <span className="text-lg">{m.emoji}</span> {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="py-6">
          {step < 2 ? (
            <button
              onClick={() => canContinue && setStep((s) => s + 1)}
              disabled={!canContinue}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Setting up…' : "Let's go! 🚀"}
            </button>
          )}
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="mt-2 w-full text-center text-sm text-ink-soft">
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
