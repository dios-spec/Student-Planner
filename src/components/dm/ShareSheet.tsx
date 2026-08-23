import { useEffect, useState } from 'react';
import { Check, Search } from 'lucide-react';
import Modal from '../shared/Modal';
import Avatar from '../shared/Avatar';
import { watchMyConversations, ensureDM } from '../../firebase/conversations';
import { sendDM } from '../../firebase/dm';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Conversation, StudentProfile } from '../../types';
import { useMeritContext } from '../../context/MeritContext';
import StudentMeritPill from '../merit/StudentMeritPill';

export interface ShareContent {
  kind: 'post' | 'reel' | 'story';
  id: string;
  imageUrl?: string;
  thumbUrl?: string;
  caption?: string;
  authorName: string;
}

/** Share sheet for sending a post/reel into DMs and groups. */
export default function ShareSheet({
  content,
  onClose,
}: {
  content: ShareContent | null;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { profiles: liveProfileMap } = useMeritContext();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [q, setQ] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!content || !user) return;
    const unsub = watchMyConversations(user.uid, setConvs);
    setSent(new Set());
    setQ('');
    return unsub;
  }, [content, user]);

  if (!content) return null;

  async function shareTo(conversation: Conversation, key: string) {
    if (!user || !profile || sent.has(key)) return;
    const cleanShared = Object.fromEntries(
      Object.entries(content!).filter(([, v]) => v !== undefined)
    ) as ShareContent;
    await sendDM({
      conversation,
      senderId: user.uid,
      senderName: profile.displayName,
      senderAvatar: profile.avatarUrl,
      kind: content!.kind === 'reel' ? 'sharedReel' : content!.kind === 'story' ? 'sharedStory' : 'sharedPost',
      shared: cleanShared,
    });
    setSent((s) => new Set(s).add(key));
    show('Shared!');
  }

  async function shareToPerson(p: StudentProfile) {
    if (!profile) return;
    const id = await ensureDM(profile, p);
    // fetch the freshly ensured conversation shape minimally
    await shareTo(
      {
        id,
        type: 'dm',
        memberIds: [profile.id, p.id],
        members: {},
        createdAt: null,
      } as Conversation,
      `dm:${p.id}`
    );
  }

  const people = Object.values(liveProfileMap).filter((p) => p.id !== user?.uid && p.onboarded);
  const groups = convs.filter((c) => c.type === 'group');
  const dmConvs = convs.filter((c) => c.type === 'dm');

  const filteredPeople = q.trim()
    ? people.filter((p) => p.displayName.toLowerCase().includes(q.toLowerCase()))
    : people;

  return (
    <Modal open={!!content} onClose={onClose} title="Share to…" fullHeight>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
        <Search size={16} className="text-ink-soft" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft" />
      </div>

      {groups.length > 0 && (
        <>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Groups</p>
          <div className="mb-4 space-y-1">
            {groups.map((c) => {
              const key = `conv:${c.id}`;
              return (
                <button key={c.id} onClick={() => shareTo(c, key)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-alt">
                  <Avatar name={c.name || 'Group'} src={c.photoUrl} size="sm" />
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  {sent.has(key) && <Check size={16} className="text-success" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">People</p>
      <div className="space-y-1">
        {filteredPeople.map((p) => {
          const existing = dmConvs.find((c) => c.memberIds.includes(p.id));
          const key = existing ? `conv:${existing.id}` : `dm:${p.id}`;
          return (
            <button
              key={p.id}
              onClick={() => (existing ? shareTo(existing, key) : shareToPerson(p))}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-alt"
            >
              <Avatar name={p.displayName} src={p.avatarUrl} emoji={p.emoji} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.displayName}</span>
                <StudentMeritPill uid={p.id} size="micro" />
              </span>
              {sent.has(key) && <Check size={16} className="text-success" />}
            </button>
          );
        })}
        {filteredPeople.length === 0 && <p className="py-4 text-center text-sm text-ink-soft">No people found.</p>}
      </div>
    </Modal>
  );
}
