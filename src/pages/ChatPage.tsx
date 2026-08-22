import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import MessageBubble from '../components/chat/MessageBubble';
import MessageInput from '../components/chat/MessageInput';
import ImagePreviewModal from '../components/chat/ImagePreviewModal';
import ProfileView from '../components/profile/ProfileView';
import { PlannerSkeleton } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { useMessages } from '../hooks/useMessages';
import { useActiveStudentCount } from '../hooks/usePresence';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { sendMessage, toggleReaction, deleteOwnMessage, reportMessage } from '../firebase/chat';
import { uploadChatImage, uploadVoiceClip } from '../firebase/storage';
import { pinClassMessage, unpinClassMessage } from '../firebase/pins';
import { useClassPins } from '../hooks/useClassPins';
import { setClassTyping } from '../firebase/typing';
import { useClassTyping } from '../hooks/useClassTyping';
import { useTypingThrottle } from '../hooks/useTypingThrottle';
import PinnedBar from '../components/chat/PinnedBar';
import TypingIndicator from '../components/chat/TypingIndicator';
import type { ChatMessage } from '../types';

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { messages, loading } = useMessages();
  const activeCount = useActiveStudentCount();
  const pinned = useClassPins();
  const typingNames = useClassTyping(user?.uid);
  const notifyTyping = useTypingThrottle((isTyping) => {
    if (user && profile) setClassTyping(user.uid, profile.displayName, isTyping);
  });
  const [replyTo, setReplyTo] = useState<ChatMessage['replyTo']>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewUid, setViewUid] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  if (!user || !profile) return null;

  async function handleSend(text: string) {
    await sendMessage({
      senderId: user!.uid,
      senderName: profile!.displayName,
      senderAvatar: profile!.avatarUrl,
      text,
      replyTo: replyTo ?? null,
    });
    setReplyTo(null);
  }

  async function handleSendImage(file: File) {
    setUploading(true);
    try {
      const url = await uploadChatImage(file, user!.uid);
      await sendMessage({
        senderId: user!.uid,
        senderName: profile!.displayName,
        senderAvatar: profile!.avatarUrl,
        imageUrl: url,
        replyTo: replyTo ?? null,
      });
      setReplyTo(null);
    } catch {
      show("Couldn't upload image. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSendVoice(blob: Blob, duration: number) {
    setUploading(true);
    try {
      const url = await uploadVoiceClip(blob, user!.uid);
      await sendMessage({
        senderId: user!.uid,
        senderName: profile!.displayName,
        senderAvatar: profile!.avatarUrl,
        audioUrl: url,
        audioDuration: duration,
        replyTo: replyTo ?? null,
      });
      setReplyTo(null);
    } catch {
      show("Couldn't send voice message.");
    } finally {
      setUploading(false);
    }
  }

  async function handleTogglePin(m: ChatMessage) {
    const isPinned = pinned.some((p) => p.messageId === m.id);
    if (isPinned) {
      await unpinClassMessage(m.id);
      return;
    }
    const preview = m.text || (m.imageUrl ? '📷 Photo' : m.audioUrl ? '🎤 Voice message' : 'Message');
    const result = await pinClassMessage({
      messageId: m.id,
      text: preview,
      senderName: m.senderName,
      pinnedBy: user!.uid,
    });
    if (result === 'full') show('Unpin something first — max 20 pinned messages.');
  }

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col">
      <TopBar
        title="Class Chat"
        right={
          activeCount != null && (
            <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
              <Users size={12} /> {activeCount} active
            </span>
          )
        }
      />

      <PinnedBar pinned={pinned} onUnpin={unpinClassMessage} />

      <div className="social-texture flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loading && <PlannerSkeleton />}
        {!loading && messages?.length === 0 && (
          <EmptyState emoji="💬" title="No messages yet" subtitle="Say hi to the class!" />
        )}
        {messages?.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isMine={m.senderId === user.uid}
            myUid={user.uid}
            onReact={(emoji, already) => toggleReaction(m.id, emoji, user.uid, already)}
            onReply={() =>
              setReplyTo({ id: m.id, senderName: m.senderName, text: m.text })
            }
            onDelete={() => deleteOwnMessage(m.id)}
            onReport={() => {
              reportMessage(m.id, user.uid);
              show('Message reported. Thanks for flagging it.');
            }}
            onImageClick={setPreviewUrl}
            onOpenProfile={setViewUid}
            pinned={pinned.some((p) => p.messageId === m.id)}
            onTogglePin={() => handleTogglePin(m)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <TypingIndicator names={typingNames} />

      <MessageInput
        onSend={handleSend}
        onSendImage={handleSendImage}
        onSendVoice={handleSendVoice}
        onTyping={notifyTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        uploading={uploading}
      />

      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      <ProfileView uid={viewUid} onClose={() => setViewUid(null)} onImageClick={setPreviewUrl} onStartDM={(id) => { setViewUid(null); navigate(`/messages?open=${id}`); }} />
    </div>
  );
}
