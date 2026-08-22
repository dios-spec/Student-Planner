import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Phone } from 'lucide-react';
import Avatar from '../shared/Avatar';
import DMBubble from './DMBubble';
import DMInput from './DMInput';
import ImagePreviewModal from '../chat/ImagePreviewModal';
import { PlannerSkeleton } from '../shared/Skeleton';
import EmptyState from '../shared/EmptyState';
import { useDMMessages } from '../../hooks/useDMMessages';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCall } from '../../context/CallContext';
import { useActiveConversation } from '../../context/ActiveConversationContext';
import { sendDM, toggleDMReaction, deleteDMMessage } from '../../firebase/dm';
import { markConversationRead } from '../../firebase/conversations';
import { uploadDMImage, uploadVoiceClip } from '../../firebase/storage';
import type { Conversation, DMMessage } from '../../types';

interface ConversationScreenProps {
  conversation: Conversation;
  onBack: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenGroupInfo: (conv: Conversation) => void;
  onOpenShared: (shared: NonNullable<DMMessage['shared']>) => void;
  blocked?: boolean;
}

export default function ConversationScreen({
  conversation, onBack, onOpenProfile, onOpenGroupInfo, onOpenShared, blocked,
}: ConversationScreenProps) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { startCall } = useCall();
  const { setActiveConversationId } = useActiveConversation();
  const { messages, loading } = useDMMessages(conversation.id);

  useEffect(() => {
    setActiveConversationId(conversation.id);
    return () => setActiveConversationId(null);
  }, [conversation.id, setActiveConversationId]);
  const [replyTo, setReplyTo] = useState<DMMessage['replyTo']>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isGroup = conversation.type === 'group';
  const otherId = isGroup ? '' : conversation.memberIds.find((m) => m !== user?.uid) || '';
  const other = conversation.members[otherId];
  const title = isGroup ? conversation.name || 'Group' : other?.name || 'Chat';
  const photo = isGroup ? conversation.photoUrl : other?.avatar;

  useEffect(() => {
    if (user) markConversationRead(conversation.id, user.uid);
  }, [conversation.id, user, messages?.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  if (!user || !profile) return null;

  async function send(partial: Parameters<typeof sendDM>[0] extends infer T ? Partial<T> : never) {
    await sendDM({
      conversation,
      senderId: user!.uid,
      senderName: profile!.displayName,
      senderAvatar: profile!.avatarUrl,
      kind: 'text',
      replyTo: replyTo ?? null,
      ...partial,
    } as Parameters<typeof sendDM>[0]);
    setReplyTo(null);
  }

  async function handleImage(file: File) {
    setUploading(true);
    try {
      const url = await uploadDMImage(file, user!.uid);
      await send({ kind: 'image', imageUrl: url });
    } catch {
      show("Couldn't send image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleVoice(blob: Blob, duration: number) {
    setUploading(true);
    try {
      const url = await uploadVoiceClip(blob, user!.uid);
      await send({ kind: 'voice', audioUrl: url, audioDuration: duration });
    } catch {
      show("Couldn't send voice message.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-paper">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]">
        <button onClick={onBack} aria-label="Back" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={() => (isGroup ? onOpenGroupInfo(conversation) : onOpenProfile(otherId))}
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <Avatar name={title} src={photo} size="sm" />
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold text-ink">{title}</p>
            {isGroup && <p className="text-xs text-ink-soft">{conversation.memberIds.length} members</p>}
          </div>
        </button>
        {!blocked && (
          <button
            onClick={async () => {
              if (!profile) return;

              try {
                await startCall(conversation, profile);
              } catch (err) {
                console.error('startCall failed:', err);
                show("Couldn't start call. Try again.");
              }
            }}
            aria-label="Voice call"
            className="rounded-full p-2 text-accent hover:bg-accent-soft"
          >
            <Phone size={20} />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loading && <PlannerSkeleton />}
        {!loading && messages?.length === 0 && (
          <EmptyState emoji="👋" title="Say hi!" subtitle="This is the start of your conversation." />
        )}
        {messages?.map((m) => (
          <DMBubble
            key={m.id}
            message={m}
            isMine={m.senderId === user.uid}
            myUid={user.uid}
            isGroup={isGroup}
            onReact={(emoji, already) => toggleDMReaction(conversation.id, m.id, emoji, user.uid, already)}
            onReply={() => setReplyTo({ id: m.id, senderName: m.senderName, preview: m.text || (m.kind === 'voice' ? '🎤 Voice' : m.kind === 'image' ? '📷 Photo' : 'Shared') })}
            onDelete={() => deleteDMMessage(conversation.id, m.id)}
            onImageClick={setPreviewUrl}
            onOpenShared={onOpenShared}
            onOpenProfile={onOpenProfile}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {blocked ? (
        <div className="border-t border-line bg-surface px-4 py-4 text-center text-sm text-ink-soft">
          You can't message this person.
        </div>
      ) : (
        <DMInput
          onSendText={(t) => send({ kind: 'text', text: t })}
          onSendImage={handleImage}
          onSendVoice={handleVoice}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          uploading={uploading}
        />
      )}

      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
