import { useState } from 'react';
import { Pencil, Megaphone, Info, Grid3x3 } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Avatar from '../components/shared/Avatar';
import Modal from '../components/shared/Modal';
import EditProfileForm from '../components/profile/EditProfileForm';
import ThemeToggle from '../components/profile/ThemeToggle';
import MyNotes from '../components/notes/MyNotes';
import AnnouncementComposer from '../components/planner/AnnouncementComposer';
import ImagePreviewModal from '../components/chat/ImagePreviewModal';
import EmptyState from '../components/shared/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useUserPosts } from '../hooks/useUserPosts';
import MoodBadge from '../components/profile/MoodBadge';
import MoodPicker from '../components/profile/MoodPicker';
import { Smile } from 'lucide-react';
import { CLASS_COLORS, isClassId } from '../data/classes';

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { posts } = useUserPosts(user?.uid);
  const [editOpen, setEditOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);

  if (!profile) return null;

  return (
    <div className="pb-24">
      <TopBar title="Profile" />

      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          <div className="relative shrink-0">
            <Avatar name={profile.displayName} src={profile.avatarUrl} emoji={profile.emoji} size="lg" />
            <MoodBadge emoji={profile.moodEmoji} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-display text-lg font-semibold text-ink">{profile.displayName}</p>
              {isClassId(profile.classId) && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: CLASS_COLORS[profile.classId] }}
                >
                  {profile.classId}
                </span>
              )}
            </div>
            {profile.bio && <p className="truncate text-sm text-ink-soft">"{profile.bio}"</p>}
            <p className="mt-0.5 text-sm font-medium text-ink">{posts?.length ?? 0} posts</p>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            aria-label="Edit profile"
            className="rounded-full bg-accent-soft p-2.5 text-accent"
          >
            <Pencil size={16} />
          </button>
        </div>

        <button
          onClick={() => setMoodOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left"
        >
          <Smile size={18} className="text-accent" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">
              {profile.moodEmoji ? `Mood: ${profile.moodEmoji} ${profile.moodLabel}` : 'Set your mood'}
            </p>
            <p className="text-xs text-ink-soft">Show a little badge on your profile</p>
          </div>
        </button>

        <div>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Grid3x3 size={16} className="text-ink-soft" />
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">My Posts</h3>
          </div>
          {posts && posts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setPreviewUrl(post.imageUrl)}
                  className="aspect-square overflow-hidden rounded-md bg-surface-alt"
                >
                  <img src={post.imageUrl} alt={post.caption || 'Post'} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState emoji="📷" title="No posts yet" subtitle="Share a photo from the Home tab." />
          )}
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
          name, photo, status and posts.
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <EditProfileForm onDone={() => setEditOpen(false)} />
      </Modal>

      <AnnouncementComposer open={announceOpen} onClose={() => setAnnounceOpen(false)} />
      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      <MoodPicker open={moodOpen} onClose={() => setMoodOpen(false)} />
    </div>
  );
}
