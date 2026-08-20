import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import Avatar from '../shared/Avatar';
import { updateUserProfile } from '../../firebase/users';
import { uploadAvatar } from '../../firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from '../../utils/moderation';

const EMOJI_OPTIONS = ['🙂', '😎', '🤓', '📚', '⚽', '🎨', '🎮', '🎵', '🦊', '🐼'];

export default function EditProfileForm({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const [name, setName] = useState(profile?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [emoji, setEmoji] = useState(profile?.emoji || '🙂');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarPick(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file, user.uid);
      setAvatarUrl(url);
    } catch {
      show("Couldn't upload photo. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: name.trim().slice(0, MAX_NAME_LENGTH),
        bio: bio.trim().slice(0, MAX_BIO_LENGTH),
        emoji,
        avatarUrl,
      });
      show('Profile updated');
      onDone();
    } catch {
      show("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <Avatar name={name || 'You'} src={avatarUrl} emoji={!avatarUrl ? emoji : undefined} size="lg" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Change photo"
            className="absolute -bottom-1 -right-1 rounded-full bg-accent p-2 text-white shadow"
          >
            <Camera size={14} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarPick(file);
              e.target.value = '';
            }}
          />
        </div>
        {uploading && <span className="text-xs text-ink-soft">Uploading…</span>}
      </div>

      {!avatarUrl && (
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Or pick an emoji avatar</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`rounded-full border p-2 text-lg ${
                  emoji === e ? 'border-accent bg-accent-soft' : 'border-line'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Status / description</label>
        <input
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={MAX_BIO_LENGTH}
          placeholder='e.g. "Football after school ⚽"'
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </div>
  );
}
