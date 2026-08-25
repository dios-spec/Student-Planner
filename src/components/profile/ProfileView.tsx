import { useEffect, useState } from 'react';
import { MessageCircle, Ban, Flag } from 'lucide-react';
import Modal from '../shared/Modal';
import Avatar from '../shared/Avatar';
import EmptyState from '../shared/EmptyState';
import ConfirmDialog from '../shared/ConfirmDialog';
import { watchUserProfile } from '../../firebase/users';
import { ensureDM } from '../../firebase/conversations';
import { blockUser, unblockUser } from '../../firebase/blocks';
import { reportMessage } from '../../firebase/chat';
import { useUserPosts } from '../../hooks/useUserPosts';
import { useBlocks } from '../../hooks/useBlocks';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import MoodBadge from './MoodBadge';
import PresenceLabel from '../shared/PresenceLabel';
import { CLASS_COLORS, isClassId } from '../../data/classes';
import type { StudentProfile } from '../../types';
import RoleBadge from './RoleBadge';
import AccountTypeBadge, { accountTypeFromProfile } from './AccountTypeBadge';
import { isVerifiedTeacherProfile } from '../../utils/roles';
import MeritSummaryCard from '../merit/MeritSummaryCard';

interface ProfileViewProps {
  uid: string | null;
  onClose: () => void;
  onImageClick: (url: string) => void;
  onStartDM?: (conversationId: string) => void;
}

export default function ProfileView({ uid, onClose, onImageClick, onStartDM }: ProfileViewProps) {
  const { user, profile: me } = useAuth();
  const { show } = useToast();
  const { iBlocked, cannotInteract } = useBlocks(user?.uid);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [confirm, setConfirm] = useState<null | { title: string; message: string; danger?: boolean; action: () => void }>(null);
  const { posts } = useUserPosts(uid || undefined);

  const isMe = uid === user?.uid;

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    return watchUserProfile(uid, (nextProfile) => {
      setProfile(nextProfile);
      setLoadingProfile(false);
    });
  }, [uid]);

  async function startDM() {
    if (!me || !profile) return;
    if (cannotInteract(profile.id)) {
      show("You can't message this person.");
      return;
    }
    const id = await ensureDM(me, profile);
    onStartDM?.(id);
  }

  const isBlocked = profile ? iBlocked.has(profile.id) : false;

  return (
    <Modal open={!!uid} onClose={onClose} title="Profile" fullHeight>
      {loadingProfile ? (
        <p className="py-8 text-center text-sm text-ink-soft">Loading…</p>
      ) : profile ? (
        <div>
          <div className="flex flex-col items-center gap-2 pb-4 text-center">
            <div className="relative">
              <Avatar name={profile.displayName} src={profile.avatarUrl} emoji={profile.emoji} size="lg" />
              <MoodBadge emoji={profile.moodEmoji} />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <p className="font-display text-lg font-semibold text-ink">{profile.displayName}</p>
                {isClassId(profile.classId) && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: CLASS_COLORS[profile.classId] }}>
                    {profile.classId}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                <RoleBadge teacher={isVerifiedTeacherProfile(profile)} />
                <AccountTypeBadge accountType={accountTypeFromProfile(profile)} />
              </div>
              {profile.moodLabel && <p className="text-xs text-ink-soft">{profile.moodEmoji} {profile.moodLabel}</p>}
              {!isMe && <PresenceLabel profile={profile} className="mt-0.5 justify-center" />}
            </div>
            {profile.bio && <p className="text-sm italic text-ink-soft">"{profile.bio}"</p>}
            <p className="text-sm font-medium text-ink">{posts?.length ?? 0} posts</p>

            {!isVerifiedTeacherProfile(profile) && (
              <div className="w-full pt-2">
                <MeritSummaryCard uid={profile.id} compact />
              </div>
            )}

            {!isMe && (
              <div className="mt-2 flex items-center gap-2">
                {onStartDM && !isBlocked && (
                  <button onClick={startDM} className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
                    <MessageCircle size={16} /> Message
                  </button>
                )}
                <button
                  onClick={() => {
                    if (isBlocked) {
                      unblockUser(user!.uid, profile.id)
                        .then(() => show(`Unblocked ${profile.displayName}`))
                        .catch(() => show("Couldn't unblock. Try again."));
                    } else {
                      setConfirm({
                        title: 'Block user?',
                        message: `${profile.displayName} won't be able to message or call you, and you won't see their DMs.`,
                        danger: true,
                        action: () => {
                          blockUser(user!.uid, profile.id)
                            .then(() => show(`Blocked ${profile.displayName}`))
                            .catch(() => show("Couldn't block. Try again."));
                        },
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft"
                >
                  <Ban size={16} /> {isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button
                  onClick={() => {
                    reportMessage(`profile:${profile.id}`, user!.uid)
                      .then(() => show('Reported. Thanks for flagging.'))
                      .catch(() => show("Couldn't report. Try again."));
                  }}
                  aria-label="Report"
                  className="rounded-full border border-line p-2 text-ink-soft"
                >
                  <Flag size={16} />
                </button>
              </div>
            )}
          </div>

          {posts && posts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <button key={post.id} onClick={() => onImageClick(post.imageUrl)} className="aspect-square overflow-hidden bg-surface-alt">
                  <img src={post.imageUrl} alt={post.caption || 'Post'} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState emoji="📷" title="No posts yet" />
          )}
        </div>
      ) : (
        <EmptyState emoji="🤷" title="Profile not found" />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        danger={confirm?.danger}
        confirmLabel="Confirm"
        onConfirm={() => { confirm?.action(); setConfirm(null); }}
        onCancel={() => setConfirm(null)}
      />
    </Modal>
  );
}
