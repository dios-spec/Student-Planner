import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import MessageBubble from '../components/chat/MessageBubble';
import MessageInput from '../components/chat/MessageInput';
import ImagePreviewModal from '../components/chat/ImagePreviewModal';
import { PlannerSkeleton } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { useMessages } from '../hooks/useMessages';
import { useActiveStudentCount } from '../hooks/usePresence';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { sendMessage, toggleReaction, deleteOwnMessage, reportMessage } from '../firebase/chat';
import { uploadChatImage } from '../firebase/storage';
import type { ChatMessage } from '../types';

export default function ChatPage() {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { messages, loading } = useMessages();
  const activeCount = useActiveStudentCount();
  const [replyTo, setReplyTo] = useState<ChatMessage['replyTo']>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
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
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSend={handleSend}
        onSendImage={handleSendImage}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        uploading={uploading}
      />

      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
