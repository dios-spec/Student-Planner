import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Megaphone, Info, Grid3x3, Bookmark, Bell, GraduationCap, ShieldCheck, Smile, Award } from 'lucide-react';
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
import { CLASS_COLORS, isClassId } from '../data/classes';
import RoleBadge from '../components/profile/RoleBadge';
import AccountTypeBadge from '../components/profile/AccountTypeBadge';
import TeacherVerificationModal from '../components/profile/TeacherVerificationModal';
import DeleteAccountDialog from '../components/profile/DeleteAccountDialog';
import MeritSummaryCard from '../components/merit/MeritSummaryCard';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, isTeacher, claimsLoading, accountType } = useAuth();
  // Growable window: the underlying listener is bounded so a prolific author
  // does not stream their whole history, but "Show more" keeps every post
  // reachable rather than silently truncating the grid.
  const POST_PAGE = 60;
  const [maxPosts, setMaxPosts] = useState(POST_PAGE);
  const { posts } = useUserPosts(user?.uid, maxPosts);
  const [editOpen, setEditOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [teacherVerifyOpen, setTeacherVerifyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <RoleBadge teacher={isTeacher} />
              <AccountTypeBadge accountType={accountType} />
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

        {!isTeacher && <MeritSummaryCard uid={profile.id} />}

        <button
          onClick={() => navigate('/merits')}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left"
        >
          <Award size={18} className="text-accent" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">
              {isTeacher ? 'Student Merit Manager' : 'Merit, Demerit & Badges'}
            </p>
            <p className="text-xs text-ink-soft">
              {isTeacher ? 'Award points to students by class' : 'See your live points, badges and history'}
            </p>
          </div>
        </button>

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

        {isTeacher ? (
          <div className="flex w-full items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-4">
            <span className="rounded-full bg-surface p-2.5 text-success">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Verified teacher access</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Your role is protected by a signed Firebase claim and is ready for teacher features.
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTeacherVerifyOpen(true)}
            disabled={claimsLoading}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left disabled:opacity-60"
          >
            <GraduationCap size={20} className="text-accent" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Are you a teacher?</p>
              <p className="text-xs text-ink-soft">Verify securely with the school teacher password</p>
            </div>
          </button>
        )}

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
                  <img loading="lazy" decoding="async" src={post.imageUrl} alt={post.caption || 'Post'} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState emoji="📷" title="No posts yet" subtitle="Share a photo from the Home tab." />
          )}
          {posts && posts.length >= maxPosts && (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setMaxPosts((n) => n + POST_PAGE)}
                className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink-soft"
              >
                Show more posts
              </button>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">Appearance</h3>
          <ThemeToggle />
        </div>

        <button
          onClick={() => navigate('/saved')}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left"
        >
          <Bookmark size={18} className="text-accent" />
          <div>
            <p className="text-sm font-semibold text-ink">Saved</p>
            <p className="text-xs text-ink-soft">Posts, reels, messages, and study material you've saved</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/settings/notifications')}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left"
        >
          <Bell size={18} className="text-accent" />
          <div>
            <p className="text-sm font-semibold text-ink">Notification Settings</p>
            <p className="text-xs text-ink-soft">Choose what notifies you, and set Quiet Hours</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/privacy')}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left"
        >
          <ShieldCheck size={18} className="text-accent" />
          <div>
            <p className="text-sm font-semibold text-ink">Privacy</p>
            <p className="text-xs text-ink-soft">What Buddy Planner stores, and who can see it</p>
          </div>
        </button>

        {isTeacher && (

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

        )}

        <MyNotes />

        <div className="mt-2 rounded-2xl border border-coral/25 bg-coral-soft/40 p-4">
          <p className="text-sm font-semibold text-ink">Delete account</p>
          <p className="mt-0.5 text-xs leading-5 text-ink-soft">
            Permanently removes your profile and personal data from Buddy Planner. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="mt-3 min-h-11 rounded-full border border-coral px-4 text-sm font-semibold text-coral"
          >
            Delete my account
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-surface-alt p-3.5 text-xs text-ink-soft">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            {accountType === 'anonymous' ? (
              <>
                Your sign-in is currently anonymous. Google or Email/Password is not required to use Buddy Planner,
                but linking one gives you a recovery path if you change devices or lose local app data.
              </>
            ) : accountType === 'google' ? (
              <>
                Your Buddy Planner account is linked to Google. Your Google email is never shown on your public
                Buddy profile; classmates only see the profile information you choose to share.
              </>
            ) : (
              <>
                Your Buddy Planner account is linked with Email/Password. Your email is never shown on your public
                Buddy profile; classmates only see the profile information you choose to share.
              </>
            )}
          </span>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <EditProfileForm onDone={() => setEditOpen(false)} />
      </Modal>

      {isTeacher && <AnnouncementComposer open={announceOpen} onClose={() => setAnnounceOpen(false)} />}
      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      <MoodPicker open={moodOpen} onClose={() => setMoodOpen(false)} />
      <TeacherVerificationModal open={teacherVerifyOpen} onClose={() => setTeacherVerifyOpen(false)} />
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
