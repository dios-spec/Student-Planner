import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, PenSquare } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import ConversationList from '../components/dm/ConversationList';
import ConversationScreen from '../components/dm/ConversationScreen';
import CreateGroup from '../components/dm/CreateGroup';
import GroupInfo from '../components/dm/GroupInfo';
import ProfileView from '../components/profile/ProfileView';
import { useConversations } from '../hooks/useConversations';
import { useBlocks } from '../hooks/useBlocks';
import { getConversationOnce } from '../firebase/conversations';
import { useAuth } from '../context/AuthContext';
import type { Conversation, DMMessage } from '../types';

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, loading } = useConversations(user?.uid);
  const { cannotInteract } = useBlocks(user?.uid);
  const [active, setActive] = useState<Conversation | null>(null);
  const [groupInfo, setGroupInfo] = useState<Conversation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewUid, setViewUid] = useState<string | null>(null);

  // Auto-open a conversation when navigated here with ?open=<id>
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) {
      getConversationOnce(openId).then((c) => {
        if (c) setActive(c);
        setSearchParams({}, { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function openById(id: string) {
    const c = await getConversationOnce(id);
    if (c) setActive(c);
  }

  function otherIdOf(c: Conversation) {
    return c.type === 'dm' ? c.memberIds.find((m) => m !== user?.uid) || '' : '';
  }

  // keep the active conversation object fresh from the live list (unread, members, etc.)
  const liveActive = active ? conversations?.find((c) => c.id === active.id) || active : null;
  const liveGroupInfo = groupInfo ? conversations?.find((c) => c.id === groupInfo.id) || groupInfo : null;

  return (
    <div className="pb-24">
      <TopBar
        title="Messages"
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setCreateOpen(true)} aria-label="New group" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <Users size={20} />
            </button>
            <button onClick={() => setViewUid('__pick__')} aria-label="New message" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
              <PenSquare size={20} />
            </button>
          </div>
        }
      />

      <ConversationList
        conversations={conversations}
        loading={loading}
        myUid={user?.uid || ''}
        onOpen={setActive}
      />

      {liveActive && (
        <ConversationScreen
          conversation={liveActive}
          onBack={() => setActive(null)}
          onOpenProfile={setViewUid}
          onOpenGroupInfo={(c) => setGroupInfo(c)}
          onOpenShared={(_shared: NonNullable<DMMessage['shared']>) => { /* opened via Home in future */ }}
          blocked={liveActive.type === 'dm' && cannotInteract(otherIdOf(liveActive))}
        />
      )}

      {liveGroupInfo && (
        <GroupInfo
          conversation={liveGroupInfo}
          onBack={() => setGroupInfo(null)}
          onLeft={() => { setGroupInfo(null); setActive(null); }}
          onOpenProfile={setViewUid}
        />
      )}

      <CreateGroup open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); openById(id); }} />

      <ProfileView
        uid={viewUid === '__pick__' ? null : viewUid}
        onClose={() => setViewUid(null)}
        onImageClick={() => {}}
        onStartDM={(convId) => { setViewUid(null); openById(convId); }}
      />
    </div>
  );
}
