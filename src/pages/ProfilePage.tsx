import { useState } from 'react';
import { Pencil, Megaphone, Info } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Avatar from '../components/shared/Avatar';
import Modal from '../components/shared/Modal';
import EditProfileForm from '../components/profile/EditProfileForm';
import ThemeToggle from '../components/profile/ThemeToggle';
import MyNotes from '../components/notes/MyNotes';
import AnnouncementComposer from '../components/planner/AnnouncementComposer';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { profile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);

  if (!profile) return null;

  return (
    <div className="pb-24">
      <TopBar title="Profile" />

      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          <Avatar name={profile.displayName} src={profile.avatarUrl} emoji={profile.emoji} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold text-ink">{profile.displayName}</p>
            {profile.bio && <p className="truncate text-sm text-ink-soft">"{profile.bio}"</p>}
          </div>
          <button
            onClick={() => setEditOpen(true)}
            aria-label="Edit profile"
            className="rounded-full bg-accent-soft p-2.5 text-accent"
          >
            <Pencil size={16} />
          </button>
        </div>

        <div>
          <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">Appearance</h3>
          <ThemeToggle />
        </div>

        <button
          onClick={() => setAnnounceOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left"
        >
          <Megaphone size={18} className="text-accent" />
          <div>
            <p className="text-sm font-semibold text-ink">Post an announcement</p>
            <p className="text-xs text-ink-soft">Share something the whole class should know</p>
          </div>
        </button>

        <MyNotes />

        <div className="flex items-start gap-2 rounded-2xl bg-surface-alt p-3.5 text-xs text-ink-soft">
          <Info size={14} className="mt-0.5 shrink-0" />
          Your profile is anonymous — no email, phone number, or password. Anyone in your class can see your
          name, photo and status.
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <EditProfileForm onDone={() => setEditOpen(false)} />
      </Modal>

      <AnnouncementComposer open={announceOpen} onClose={() => setAnnounceOpen(false)} />
    </div>
  );
}
