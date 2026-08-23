import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import MessageBubble from '../components/chat/MessageBubble';
import MessageInput from '../components/chat/MessageInput';
import ImagePreviewModal from '../components/chat/ImagePreviewModal';
import ProfileView from '../components/profile/ProfileView';
import { PlannerSkeleton } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import CreatePollSheet from '../components/chat/CreatePollSheet';
import { useTeacherMessages } from '../hooks/useTeacherMessages';
import { useLiveProfiles, liveAvatar, liveName } from '../hooks/useLiveProfiles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { uploadChatImage, uploadVoiceClip } from '../firebase/storage';
import {
  closeTeacherPoll,
  deleteOwnTeacherMessage,
  editTeacherMessage,
  reportTeacherMessage,
  sendTeacherMessage,
  sendTeacherPoll,
  toggleTeacherReaction,
  voteOnTeacherPoll,
} from '../firebase/teacherChat';
import type { ChatMessage } from '../types';

export default function TeacherChatPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { messages, loading } = useTeacherMessages();
  const profiles = useLiveProfiles(messages.map((message) => message.senderId));

  const [replyTo, setReplyTo] = useState<ChatMessage['replyTo']>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewUid, setViewUid] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (!user || !profile) return null;

  async function handleSend(text: string) {
    try {
      await sendTeacherMessage({
        senderId: user!.uid,
        senderName: profile!.displayName,
        senderAvatar: profile!.avatarUrl,
        text,
        replyTo: replyTo ?? null,
      });
      setReplyTo(null);
    } catch {
      show("Couldn't send message. Try again.");
    }
  }

  async function handleSendImage(file: File) {
    setUploading(true);
    try {
      const url = await uploadChatImage(file, user!.uid);
      await sendTeacherMessage({
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
      await sendTeacherMessage({
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

  async function handleCreatePoll(question: string, options: string[], allowMultiple: boolean) {
    try {
      await sendTeacherPoll({
        senderId: user!.uid,
        senderName: profile!.displayName,
        senderAvatar: profile!.avatarUrl,
        question,
        options,
        allowMultiple,
      });
    } catch {
      show("Couldn't create poll.");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] flex-col">
      <TopBar
        title="Teachers Chat"
        right={
          <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            <BadgeCheck size={13} /> Verified only
          </span>
        }
      />

      <div className="border-b border-line bg-surface-alt/70 px-4 py-2 text-center text-xs text-ink-soft">
        Private chat for verified teachers. Students cannot read or write this channel.
      </div>

      <div className="social-texture flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loading && <PlannerSkeleton />}
        {!loading && messages.length === 0 && (
          <EmptyState
            emoji={'\u{1F469}\u200D\u{1F3EB}'}
            title="No teacher messages yet"
            subtitle="Start the teachers-only conversation."
          />
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={{
              ...message,
              senderName: liveName(profiles, message.senderId, message.senderName),
              senderAvatar: liveAvatar(profiles, message.senderId, message.senderAvatar),
            }}
            isMine={message.senderId === user.uid}
            myUid={user.uid}
            onReact={(emoji, already) =>
              toggleTeacherReaction(message.id, emoji, user.uid, already)
            }
            onReply={() =>
              setReplyTo({
                id: message.id,
                senderName: message.senderName,
                text: message.text,
              })
            }
            onDelete={() => deleteOwnTeacherMessage(message.id)}
            onReport={() => {
              reportTeacherMessage(message.id, user.uid);
              show('Message reported.');
            }}
            onImageClick={setPreviewUrl}
            onOpenProfile={setViewUid}
            pinned={false}
            onTogglePin={() => {}}
            onVotePoll={(optionId) => voteOnTeacherPoll(message.id, optionId, user.uid)}
            onClosePoll={() => closeTeacherPoll(message.id)}
            onEditMessage={(newText) => editTeacherMessage(message.id, newText)}
            saved={false}
            onToggleSave={() => {}}
            hidePinAndSave
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSend={handleSend}
        onSendImage={handleSendImage}
        onSendVoice={handleSendVoice}
        onCreatePoll={() => setPollOpen(true)}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        uploading={uploading}
        placeholder="Message the teachers..."
      />

      <CreatePollSheet
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        onCreate={handleCreatePoll}
      />

      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      <ProfileView
        uid={viewUid}
        onClose={() => setViewUid(null)}
        onImageClick={setPreviewUrl}
        onStartDM={(id) => {
          setViewUid(null);
          navigate(`/messages?open=${id}`);
        }}
      />
    </div>
  );
}
