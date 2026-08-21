import { useEffect, useState } from 'react';
import { Users, PenSquare, Search, X } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import ConversationList from '../components/dm/ConversationList';
import ConversationScreen from '../components/dm/ConversationScreen';
import CreateGroup from '../components/dm/CreateGroup';
import GroupInfo from '../components/dm/GroupInfo';
import ProfileView from '../components/profile/ProfileView';
import Avatar from '../components/shared/Avatar';
import { useConversations } from '../hooks/useConversations';
import { useBlocks } from '../hooks/useBlocks';
import { getConversationOnce, listAllProfiles } from '../firebase/conversations';
import { useAuth } from '../context/AuthContext';
import type { Conversation, DMMessage, StudentProfile } from '../types';

export default function MessagesPage() {
  const { user } = useAuth();
  const { conversations, loading } = useConversations(user?.uid);
  const { cannotInteract } = useBlocks(user?.uid);
  const [active, setActive] = useState<Conversation | null>(null);
  const [groupInfo, setGroupInfo] = useState<Conversation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewUid, setViewUid] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allProfiles, setAllProfiles] = useState<StudentProfile[]>([]);

  useEffect(() => {
    if (searchOpen && user && allProfiles.length === 0) {
      listAllProfiles(user.uid).then(setAllProfiles);
    }
  }, [searchOpen, user, allProfiles.length]);

  async function openById(id: string) {
    const c = await getConversationOnce(id);
    if (c) setActive(c);
  }

  function otherIdOf(c: Conversation) {
    return c.type === 'dm' ? c.memberIds.find((m) => m !== user?.uid) || '' : '';
  }

  const liveActive = active ? conversations?.find((c) => c.id === active.id) || active : null;
  const liveGroupInfo = groupInfo ? conversations?.find((c) => c.id === groupInfo.id) || groupInfo : null;

  const q = query.trim().toLowerCase();
  const convTitle = (c: Conversation) =>
    c.type === 'group' ? (c.name || 'Group') : (c.members[otherIdOf(c)]?.name || '');

  const filteredConvos = q ? (conversations || []).filter((c) => convTitle(c).toLowerCase().includes(q)) : conversations;
  const matchedProfiles = q ? allProfiles.filter((p) => p.displayName.toLowerCase().includes(q)) : [];

  return (
    <div className="pb-24">
      <TopBar
        title="Messages"
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchOpen((o) => !o)} aria-label="Search" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <Search size={20} />
            </button>
            <button onClick={() => setCreateOpen(true)} aria-label="New group" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <Users size={20} />
            </button>
            <button onClick={() => setViewUid('__pick__')} aria-label="New message" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <PenSquare size={20} />
            </button>
          </div>
        }
      />

      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <Search size={16} className="text-ink-soft" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and people..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {query && <button onClick={() => setQuery('')} aria-label="Clear"><X size={16} className="text-ink-soft" /></button>}
        </div>
      )}

      {q ? (
        <div className="pb-4">
          {filteredConvos && filteredConvos.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase text-ink-soft">Chats</p>
              <ConversationList conversations={filteredConvos} loading={false} myUid={user?.uid || ''} onOpen={setActive} />
            </>
          )}
          {matchedProfiles.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase text-ink-soft">People</p>
              <div className="divide-y divide-line">
                {matchedProfiles.map((p) => (
                  <button key={p.id} onClick={() => setViewUid(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-alt">
                    <Avatar name={p.displayName} src={p.avatarUrl} size="sm" />
                    <span className="text-sm font-medium text-ink">{p.displayName}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {(!filteredConvos || filteredConvos.length === 0) && matchedProfiles.length === 0 && (
            <p className="px-4 pt-8 text-center text-sm text-ink-soft">No matches for "{query}"</p>
          )}
        </div>
      ) : (
        <ConversationList conversations={conversations} loading={loading} myUid={user?.uid || ''} onOpen={setActive} />
      )}

      {liveActive && (
        <ConversationScreen
          conversation={liveActive}
          onBack={() => setActive(null)}
          onOpenProfile={setViewUid}
          onOpenGroupInfo={(c) => setGroupInfo(c)}
          onOpenShared={(_shared: NonNullable<DMMessage['shared']>) => {}}
          blocked={liveActive.type === 'dm' && cannotInteract(otherIdOf(liveActive))}
        />
      )}

      {liveGroupInfo && (
        <GroupInfo conversation={liveGroupInfo} onBack={() => setGroupInfo(null)} onLeft={() => { setGroupInfo(null); setActive(null); }} onOpenProfile={setViewUid} />
      )}

      <CreateGroup open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); openById(id); }} />

      <ProfileView
        uid={viewUid === '__pick__' ? null : viewUid}
        onClose={() => setViewUid(null)}
        onImageClick={() => {}}
        onStartDM={(convId) => { setViewUid(null); setQuery(''); setSearchOpen(false); openById(convId); }}
      />
    </div>
  );
}
