import Modal from '../shared/Modal';
import { MOODS } from '../../data/moods';
import { updateUserProfile } from '../../firebase/users';
import { useAuth } from '../../context/AuthContext';

export default function MoodPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();

  async function set(emoji?: string, label?: string) {
    if (!user) return;
    await updateUserProfile(user.uid, { moodEmoji: emoji, moodLabel: label });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Set your mood">
      <div className="grid grid-cols-2 gap-2">
        {MOODS.map((m) => (
          <button
            key={m.label}
            onClick={() => set(m.emoji, m.label)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
              profile?.moodLabel === m.label ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink'
            }`}
          >
            <span className="text-lg">{m.emoji}</span> {m.label}
          </button>
        ))}
      </div>
      {profile?.moodEmoji && (
        <button
          onClick={() => set(undefined, undefined)}
          className="mt-4 w-full rounded-full border border-line py-2.5 text-sm font-medium text-ink-soft"
        >
          Clear mood
        </button>
      )}
    </Modal>
  );
}
