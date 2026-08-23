import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Camera,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import Avatar from '../shared/Avatar';
import { CLASSES, CLASS_COLORS, type ClassId } from '../../data/classes';
import { MOODS } from '../../data/moods';
import { updateUserProfile } from '../../firebase/users';
import { uploadAvatar } from '../../firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from '../../utils/moderation';
import { TeacherVerificationError } from '../../firebase/teacherVerification';
import type { AppRole } from '../../types';

const EMOJI_OPTIONS = ['🙂', '😎', '🤓', '📚', '⚽', '🎨', '🎮', '🎵', '🦊', '🐼'];
const LAST_STEP = 3;

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { user, profile, isTeacher, claimsLoading, verifyTeacher } = useAuth();
  const { show } = useToast();
  const [step, setStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(isTeacher ? 'teacher' : null);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🙂');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [bio, setBio] = useState('');
  const [classId, setClassId] = useState<ClassId | null>(null);
  const [mood, setMood] = useState<{ emoji: string; label: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isTeacher) {
      setSelectedRole('teacher');
      setTeacherPassword('');
      setVerificationError('');
    }
  }, [isTeacher]);

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

  async function continueFromRole() {
    if (!selectedRole || verifying) return;
    setVerificationError('');

    if (selectedRole === 'teacher' && !isTeacher) {
      if (!teacherPassword) return;
      setVerifying(true);
      try {
        await verifyTeacher(teacherPassword);
        setTeacherPassword('');
      } catch (caught) {
        setTeacherPassword('');
        setVerificationError(
          caught instanceof TeacherVerificationError
            ? caught.message
            : 'Teacher verification failed. Try again.'
        );
        setVerifying(false);
        return;
      }
      setVerifying(false);
    }

    setStep(1);
  }

  async function finish() {
    if (!user || !classId || !selectedRole) return;
    if (selectedRole === 'teacher' && !isTeacher) {
      setStep(0);
      setVerificationError('Verify the teacher password before continuing.');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName:
          name.trim().slice(0, MAX_NAME_LENGTH) ||
          (profile?.displayName ?? (selectedRole === 'teacher' ? 'Teacher' : 'Student')),
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
    (step === 0 &&
      (selectedRole === 'student' ||
        (selectedRole === 'teacher' && (isTeacher || teacherPassword.length > 0)))) ||
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && !!classId) ||
    step === LAST_STEP;

  function selectRole(role: AppRole) {
    if (isTeacher && role === 'student') return;
    setSelectedRole(role);
    setTeacherPassword('');
    setVerificationError('');
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto px-6 pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="mb-8 flex justify-center gap-2" aria-label={`Setup step ${step + 1} of ${LAST_STEP + 1}`}>
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all ${index === step ? 'w-8 bg-accent' : 'w-1.5 bg-line'}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="flex flex-1 flex-col">
            <h1 className="font-display text-2xl font-bold text-ink">Choose your role</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Students join instantly. Teachers verify securely with the school password.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => selectRole('student')}
                disabled={isTeacher}
                aria-pressed={selectedRole === 'student'}
                className={`flex min-h-36 flex-col items-start rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-45 ${
                  selectedRole === 'student' ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                }`}
              >
                <span className="rounded-full bg-surface-alt p-2.5 text-accent">
                  <BookOpen size={23} aria-hidden="true" />
                </span>
                <span className="mt-3 font-display text-lg font-semibold text-ink">Student</span>
                <span className="mt-0.5 text-xs text-ink-soft">Join your class workspace</span>
              </button>

              <button
                type="button"
                onClick={() => selectRole('teacher')}
                aria-pressed={selectedRole === 'teacher'}
                className={`flex min-h-36 flex-col items-start rounded-2xl border-2 p-4 text-left transition-colors ${
                  selectedRole === 'teacher' ? 'border-success bg-success-soft' : 'border-line bg-surface'
                }`}
              >
                <span className="rounded-full bg-surface-alt p-2.5 text-success">
                  {isTeacher ? <ShieldCheck size={23} aria-hidden="true" /> : <GraduationCap size={23} aria-hidden="true" />}
                </span>
                <span className="mt-3 font-display text-lg font-semibold text-ink">Teacher</span>
                <span className="mt-0.5 text-xs text-ink-soft">
                  {isTeacher ? 'Verified securely' : 'School password required'}
                </span>
              </button>
            </div>

            {selectedRole === 'teacher' && !isTeacher && (
              <div className="mt-5">
                <label htmlFor="onboarding-teacher-password" className="mb-1.5 block text-sm font-semibold text-ink">
                  Teacher password
                </label>
                <div className="relative">
                  <input
                    id="onboarding-teacher-password"
                    type={showTeacherPassword ? 'text' : 'password'}
                    value={teacherPassword}
                    onChange={(event) => setTeacherPassword(event.target.value)}
                    maxLength={256}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={!!verificationError}
                    aria-describedby="onboarding-teacher-help"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-3 pr-11 text-sm text-ink outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-soft"
                    aria-label={showTeacherPassword ? 'Hide teacher password' : 'Show teacher password'}
                  >
                    {showTeacherPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div id="onboarding-teacher-help" className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
                  <LockKeyhole size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Checked on the server. Never stored in this app or your profile.
                </div>
                {verificationError && (
                  <p className="mt-2 text-sm font-medium text-coral" role="alert">{verificationError}</p>
                )}
              </div>
            )}

            {selectedRole === 'teacher' && isTeacher && (
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-success-soft p-3 text-sm font-medium text-success">
                <ShieldCheck size={18} aria-hidden="true" /> Teacher access verified
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h1 className="font-display text-2xl font-bold text-ink">Welcome! 👋</h1>
            <p className="mt-1 text-sm text-ink-soft">Set up the profile people in your school will see.</p>

            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar name={name || 'You'} src={avatarUrl} emoji={!avatarUrl ? emoji : undefined} size="lg" />
                <button
                  type="button"
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
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleAvatar(file);
                    event.target.value = '';
                  }}
                />
              </div>
              {uploading && <span className="text-xs text-ink-soft">Uploading…</span>}
              {!avatarUrl && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {EMOJI_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setEmoji(option)}
                      aria-label={`Use ${option} as avatar`}
                      aria-pressed={emoji === option}
                      className={`rounded-full border p-1.5 text-base ${emoji === option ? 'border-accent bg-accent-soft' : 'border-line'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <label htmlFor="onboarding-name" className="mb-1.5 block text-sm font-semibold text-ink">Your name</label>
              <input
                id="onboarding-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_NAME_LENGTH}
                placeholder="What should we call you?"
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm text-ink outline-none focus:border-accent"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="onboarding-bio" className="mb-1.5 block text-sm font-semibold text-ink">Short bio (optional)</label>
              <input
                id="onboarding-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={MAX_BIO_LENGTH}
                placeholder='e.g. "Loves football ⚽"'
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <h1 className="font-display text-2xl font-bold text-ink">
              {selectedRole === 'teacher' ? 'Choose your home class' : 'Which class are you in?'}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {selectedRole === 'teacher'
                ? 'This class opens first. You can still switch class views anytime.'
                : "You'll see your class's homework, tests and study help."}
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {CLASSES.map((classOption) => (
                <button
                  type="button"
                  key={classOption}
                  onClick={() => setClassId(classOption)}
                  aria-pressed={classId === classOption}
                  className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 font-display text-2xl font-bold transition-all ${
                    classId === classOption ? 'text-white' : 'border-line text-ink-soft'
                  }`}
                  style={classId === classOption ? { backgroundColor: CLASS_COLORS[classOption], borderColor: CLASS_COLORS[classOption] } : undefined}
                >
                  {classOption}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === LAST_STEP && (
          <div className="flex flex-1 flex-col">
            <h1 className="font-display text-2xl font-bold text-ink">Set a mood? (optional)</h1>
            <p className="mt-1 text-sm text-ink-soft">Shows a little badge on your profile. You can change it anytime.</p>
            <div className="mt-8 grid grid-cols-2 gap-2">
              {MOODS.map((option) => (
                <button
                  type="button"
                  key={option.label}
                  onClick={() => setMood(mood?.label === option.label ? null : option)}
                  aria-pressed={mood?.label === option.label}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    mood?.label === option.label ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink'
                  }`}
                >
                  <span className="text-lg">{option.emoji}</span> {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {step < LAST_STEP ? (
            <button
              type="button"
              onClick={() => (step === 0 ? continueFromRole() : canContinue && setStep((current) => current + 1))}
              disabled={!canContinue || verifying || claimsLoading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {verifying ? 'Verifying securely…' : 'Continue'}
              {!verifying && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={saving}
              className="w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Setting up…' : "Let's go! 🚀"}
            </button>
          )}
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((current) => current - 1)}
              disabled={saving || verifying}
              className="mt-2 w-full text-center text-sm text-ink-soft disabled:opacity-50"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
