import { useState } from 'react';
import Modal from '../shared/Modal';
import { ArrowLeft, UserPlus, LogOut, Shield, ShieldOff, UserMinus, Pencil, Check } from 'lucide-react';
import Avatar from '../shared/Avatar';
import ConfirmDialog from '../shared/ConfirmDialog';
import { addGroupMembers, removeGroupMember, promoteToAdmin, demoteAdmin, leaveGroup, updateGroupInfo } from '../../firebase/conversations';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLiveProfiles, liveName, liveAvatar } from '../../hooks/useLiveProfiles';
import type { Conversation } from '../../types';
import { useMeritContext } from '../../context/MeritContext';
import StudentMeritPill from '../merit/StudentMeritPill';

interface GroupInfoProps {
  conversation: Conversation;
  onBack: () => void;
  onLeft: () => void;
  onOpenProfile: (uid: string) => void;
}

export default function GroupInfo({ conversation, onBack, onLeft, onOpenProfile }: GroupInfoProps) {
  const { user } = useAuth();
  const { show } = useToast();
  const { profiles: liveProfileMap } = useMeritContext();
  const isAdmin = conversation.adminIds?.includes(user?.uid || '') ?? false;
  const admins = conversation.adminIds || [];
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.name || '');
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; message: string; danger?: boolean; action: () => void | Promise<void> }>(null);

  const people = Object.values(liveProfileMap).filter(
    (p) => p.id !== user?.uid && p.onboarded && !conversation.memberIds.includes(p.id)
  );
  const members = conversation.memberIds;
  const profiles = useLiveProfiles(members);
  // Prefer the LIVE profile over the denormalized snapshot frozen on the
  // conversation doc when each member was added -- same pattern used for
  // chat bubbles, posts, reels, and stories.
  const memberInfo = (id: string) => {
    const fallback = conversation.members[id] || { name: 'Unknown' };
    return {
      name: liveName(profiles, id, fallback.name),
      avatar: liveAvatar(profiles, id, fallback.avatar),
    };
  };

  const adminMembers = members.filter((m) => admins.includes(m));
  const regularMembers = members.filter((m) => !admins.includes(m));

  async function handleLeave() {
    if (!user) return;
    // last admin must promote someone first
    if (isAdmin && adminMembers.length === 1 && members.length > 1) {
      show('Promote another member to admin before leaving.');
      return;
    }
    // BUG-23: only navigate away if the write actually succeeded.
    try {
      await leaveGroup(conversation.id, user.uid);
    } catch {
      show("Couldn't leave the group. Try again.");
      return;
    }
    onLeft();
  }

  async function saveName() {
    if (nameDraft.trim()) {
      await updateGroupInfo(conversation.id, { name: nameDraft.trim() });
      setEditingName(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-paper">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]">
        <button onClick={onBack} aria-label="Back" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
          <ArrowLeft size={20} />
        </button>
        <p className="font-display text-lg font-semibold text-ink">Group Info</p>
      </header>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="flex flex-col items-center gap-2 px-4 py-6">
          <Avatar name={conversation.name || 'Group'} src={conversation.photoUrl} size="lg" />
          {editingName && isAdmin ? (
            <div className="flex items-center gap-2">
              <input aria-label="Group name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value.slice(0, 40))}
                className="rounded-xl border border-line bg-surface px-3 py-1.5 text-center text-lg font-semibold outline-none focus:border-accent" />
              <button
                onClick={saveName}
                aria-label="Save group name"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white"
              >
                <Check size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-ink">{conversation.name}</h1>
              {isAdmin && (
                <button onClick={() => { setNameDraft(conversation.name || ''); setEditingName(true); }} className="text-ink-soft">
                  <Pencil size={15} />
                </button>
              )}
            </div>
          )}
          {conversation.description && <p className="text-center text-sm text-ink-soft">{conversation.description}</p>}
          <p className="text-xs text-ink-soft">{members.length} members</p>
        </div>

        {isAdmin && (
          <div className="px-4 pb-4">
            <button onClick={() => setAddOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-accent">
              <UserPlus size={18} /> Add members
            </button>
          </div>
        )}

        <div className="px-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Admins</p>
          <div className="space-y-1">
            {adminMembers.map((id) => (
              <MemberRow key={id} id={id} info={memberInfo(id)} isAdminBadge me={user?.uid === id}
                canManage={isAdmin && user?.uid !== id}
                onOpenProfile={onOpenProfile}
                onDemote={() => setConfirm({ title: 'Remove admin?', message: `Remove admin rights from ${memberInfo(id).name}?`, action: () => demoteAdmin(conversation.id, id) })}
              />
            ))}
          </div>
        </div>

        {regularMembers.length > 0 && (
          <div className="mt-4 px-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Members</p>
            <div className="space-y-1">
              {regularMembers.map((id) => (
                <MemberRow key={id} id={id} info={memberInfo(id)} me={user?.uid === id}
                  canManage={isAdmin && user?.uid !== id}
                  onOpenProfile={onOpenProfile}
                  onPromote={() => setConfirm({ title: 'Make admin?', message: `Give ${memberInfo(id).name} admin rights?`, action: () => promoteToAdmin(conversation.id, id) })}
                  onRemove={() => setConfirm({ title: 'Remove member?', message: `Remove ${memberInfo(id).name} from the group?`, danger: true, action: () => removeGroupMember(conversation.id, id) })}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 px-4">
          <button onClick={() => setConfirm({ title: 'Leave group?', message: 'You will stop receiving messages from this group.', danger: true, action: handleLeave })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">
            <LogOut size={18} /> Leave Group
          </button>
        </div>
      </div>

      {/* Add members. This was a hand-rolled sheet -- raw divs with a click
          backdrop, no role, no focus trap, no Escape, no body scroll lock, and
          its own max-height and radius that did not match any other sheet in
          the app. Using the shared Modal fixes all of that in one move and
          keeps overlays visually consistent. */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add members">
        <div className="space-y-1">
          {people.length === 0 && (
            <p className="py-4 text-center text-sm text-ink-soft">Everyone's already in.</p>
          )}
          {people.map((p) => (
              <button key={p.id}
                onClick={async () => {
                  try {
                    await addGroupMembers(conversation.id, [p]);
                    show(`Added ${p.displayName}`);
                  } catch {
                    show("Couldn't add that member. Try again.");
                  }
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-alt">
                <Avatar name={p.displayName} src={p.avatarUrl} emoji={p.emoji} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.displayName}</span>
                  <StudentMeritPill uid={p.id} size="micro" />
                </span>
                <UserPlus size={16} className="text-accent" aria-hidden="true" />
              </button>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        danger={confirm?.danger}
        confirmLabel="Confirm"
        onConfirm={async () => {
          const pending = confirm;
          setConfirm(null);
          if (!pending) return;
          try {
            // These actions are async and were previously fired un-awaited, so
            // every rejection vanished as an unhandled promise. conversations.ts
            // deliberately throws "A group must keep at least one admin." and
            // the rules reject removing a member from a 2-person group -- the
            // dialog just closed and the user was left thinking it worked.
            await pending.action();
          } catch (err) {
            show(err instanceof Error ? err.message : "That change could not be saved.");
          }
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function MemberRow({
  id, info, isAdminBadge, me, canManage, onOpenProfile, onPromote, onDemote, onRemove,
}: {
  id: string;
  info: { name: string; avatar?: string };
  isAdminBadge?: boolean;
  me?: boolean;
  canManage?: boolean;
  onOpenProfile: (uid: string) => void;
  onPromote?: () => void;
  onDemote?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      <button onClick={() => onOpenProfile(id)}>
        <Avatar name={info.name} src={info.avatar} size="sm" />
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={() => onOpenProfile(id)} className="block w-full truncate text-left text-sm text-ink">
          {info.name} {me && <span className="text-ink-soft">(You)</span>}
        </button>
        <StudentMeritPill uid={id} size="micro" />
      </div>
      {isAdminBadge && (
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-3xs font-bold text-accent">Admin</span>
      )}
      {canManage && (
        <div className="flex items-center gap-1">
          {onPromote && (
            <button onClick={onPromote} aria-label="Make admin" className="rounded-full p-1.5 text-ink-soft hover:text-accent">
              <Shield size={15} />
            </button>
          )}
          {onDemote && (
            <button onClick={onDemote} aria-label="Remove admin" className="rounded-full p-1.5 text-ink-soft hover:text-coral">
              <ShieldOff size={15} />
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} aria-label="Remove member" className="rounded-full p-1.5 text-ink-soft hover:text-coral">
              <UserMinus size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
