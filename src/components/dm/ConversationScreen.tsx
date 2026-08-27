import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Phone, Image as ImageIcon } from 'lucide-react';
import Avatar from '../shared/Avatar';
import DMBubble from './DMBubble';
import DMInput from './DMInput';
import ImagePreviewModal from '../chat/ImagePreviewModal';
import { PlannerSkeleton } from '../shared/Skeleton';
import EmptyState from '../shared/EmptyState';
import { useDMMessages } from '../../hooks/useDMMessages';
import { useTranscript } from '../../hooks/useTranscript';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCall } from '../../context/CallContext';
import { useActiveConversation } from '../../context/ActiveConversationContext';
import { sendDM, toggleDMReaction, deleteDMMessage, voteOnDMPoll, closeDMPoll, editDMMessage, loadOlderDMMessages } from '../../firebase/dm';
import { sfxSend, sfxPop, sfxSelect, sfxError } from '../../utils/sfx';
import { useSavedItems } from '../../hooks/useSavedItems';
import { saveItem, unsaveItem } from '../../firebase/saved';
import { markConversationRead } from '../../firebase/conversations';
import { pinDMMessage, unpinDMMessage } from '../../firebase/pins';
import { setConversationTyping, typingNamesFrom } from '../../firebase/typing';
import { useTypingThrottle } from '../../hooks/useTypingThrottle';
import { uploadDMImage, uploadVoiceClip } from '../../firebase/storage';
import { watchUserProfile } from '../../firebase/users';
import { useLiveProfiles, liveName, liveAvatar } from '../../hooks/useLiveProfiles';
import PinnedBar from '../chat/PinnedBar';
import TypingIndicator from '../chat/TypingIndicator';
import PresenceLabel from '../shared/PresenceLabel';
import CreatePollSheet from '../chat/CreatePollSheet';
import MediaBrowser from './MediaBrowser';
import type { Conversation, DMMessage, StudentProfile } from '../../types';
import type { InteractionState } from '../../utils/blockPolicy';
import StudentMeritPill from '../merit/StudentMeritPill';

interface ConversationScreenProps {
  conversation: Conversation;
  onBack: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenGroupInfo: (conv: Conversation) => void;
  onOpenShared: (shared: NonNullable<DMMessage['shared']>) => void;
  /** 'loading' until the block lists have arrived; see utils/blockPolicy. */
  interaction?: InteractionState;
}

export default function ConversationScreen({
  conversation, onBack, onOpenProfile, onOpenGroupInfo, onOpenShared, interaction = 'open',
}: ConversationScreenProps) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const { startCall } = useCall();
  const { setActiveConversationId } = useActiveConversation();
  const { messages: liveMessages, loading } = useDMMessages(conversation.id);

  // watchDMMessages only ever returns the newest 40. useTranscript accumulates
  // everything seen so history does not fall into the gap between the sliding
  // live window and the once-anchored older pages. MessagesPage keys this
  // component by conversation id, so switching threads remounts it clean.
  const { items: transcript, prependOlder } = useTranscript<DMMessage>(liveMessages);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMoreOlder, setNoMoreOlder] = useState(false);

  const messages = liveMessages === null && transcript.length === 0 ? null : transcript;

  async function handleLoadOlder() {
    const oldest = messages && messages[0];
    if (!oldest?.createdAt || loadingOlder || noMoreOlder) return;
    setLoadingOlder(true);
    try {
      const page = await loadOlderDMMessages(conversation.id, oldest.createdAt);
      if (!page.length) {
        setNoMoreOlder(true);
      } else {
        const el = messageListRef.current;
        if (el) pendingScrollRef.current = { height: el.scrollHeight, top: el.scrollTop };
        prependOlder(page);
      }
    } catch {
      show("Couldn't load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  const profiles = useLiveProfiles((messages || []).map((m) => m.senderId));
  const { isSaved } = useSavedItems(user?.uid);
  const typingNames = typingNamesFrom(conversation.typing, user?.uid || '');
  const notifyTyping = useTypingThrottle((isTyping) => {
    if (user && profile) setConversationTyping(conversation.id, user.uid, profile.displayName, isTyping);
  });

  useEffect(() => {
    setActiveConversationId(conversation.id);
    return () => setActiveConversationId(null);
  }, [conversation.id, setActiveConversationId]);
  const [replyTo, setReplyTo] = useState<DMMessage['replyTo']>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<{ height: number; top: number } | null>(null);

  // Prepending an older page grows the list upward; without this the viewport
  // would appear to jump. Restore the reading position by the height delta.
  useLayoutEffect(() => {
    const el = messageListRef.current;
    const pending = pendingScrollRef.current;
    if (!el || !pending) return;
    pendingScrollRef.current = null;
    el.scrollTop = el.scrollHeight - pending.height + pending.top;
  }, [transcript.length]);

  const isGroup = conversation.type === 'group';
  const otherId = isGroup ? '' : conversation.memberIds.find((m) => m !== user?.uid) || '';
  const other = conversation.members[otherId];
  const [otherProfile, setOtherProfile] = useState<StudentProfile | null>(null);
  // Prefer the LIVE profile (renamed/avatar-changed) over the denormalized
  // snapshot frozen on the conversation doc at creation time.
  const title = isGroup ? conversation.name || 'Group' : (otherProfile?.displayName || other?.name || 'Chat');
  const photo = isGroup ? conversation.photoUrl : (otherProfile?.avatarUrl ?? other?.avatar);

  // Read receipts: only computed for the sender's most recent message, kept
  // compact (single label, not per-bubble ticks) per the "don't clutter" rule.
  const lastMineId = [...(messages || [])].reverse().find((m) => m.senderId === user?.uid)?.id;
  function receiptLabelFor(m: DMMessage): string | undefined {
    if (m.id !== lastMineId) return undefined;
    const createdMs = m.createdAt?.toMillis?.() ?? 0;
    if (!createdMs) return 'Sent';
    if (isGroup) {
      const others = conversation.memberIds.filter((id) => id !== user?.uid);
      const seenCount = others.filter((id) => {
        const t = conversation.lastReadAt?.[id];
        return t && t.toMillis() >= createdMs;
      }).length;
      return seenCount > 0 ? `Seen by ${seenCount}` : 'Sent';
    }
    const seenAt = conversation.lastReadAt?.[otherId]?.toMillis?.() ?? 0;
    if (seenAt >= createdMs) return 'Seen';
    const deliveredAt = otherProfile?.lastSeen?.toMillis?.() ?? 0;
    if (deliveredAt >= createdMs) return 'Delivered';
    return 'Sent';
  }

  useEffect(() => {
    if (isGroup || !otherId) { setOtherProfile(null); return; }
    return watchUserProfile(otherId, setOtherProfile);
  }, [isGroup, otherId]);

  // BUG-06: messages.length is pinned by limit(40), so it stops changing in any
  // conversation past 40 messages. Key off the newest message id instead.
  const newestMsgId = messages && messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (user) markConversationRead(conversation.id, user.uid);
  }, [conversation.id, user, newestMsgId]);

  useEffect(() => {
    if (loading) return;

    const scrollToLatest = () => {
      const el = messageListRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
    };

    scrollToLatest();
    const frame = window.requestAnimationFrame(scrollToLatest);
    const timer1 = window.setTimeout(scrollToLatest, 120);
    const timer2 = window.setTimeout(scrollToLatest, 500);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
  }, [loading, newestMsgId]);

  if (!user || !profile) return null;

  async function send(partial: Parameters<typeof sendDM>[0] extends infer T ? Partial<T> : never) {
    try {
      await sendDM({
        conversation,
        senderId: user!.uid,
        senderName: profile!.displayName,
        senderAvatar: profile!.avatarUrl,
        kind: 'text',
        replyTo: replyTo ?? null,
        ...partial,
      } as Parameters<typeof sendDM>[0]);
      sfxSend();
      setReplyTo(null);
    } catch {
      // BUG-23 family: never silently pretend a message was delivered.
      sfxError();
      show("Couldn't send. Check your connection.");
    }
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

  async function handleTogglePin(m: DMMessage) {
    const isPinned = (conversation.pinned || []).some((p) => p.messageId === m.id);
    if (isPinned) {
      await unpinDMMessage(conversation, m.id);
      return;
    }
    const preview =
      m.text ||
      (m.kind === 'image' ? '📷 Photo' :
       m.kind === 'voice' ? '🎤 Voice message' :
       m.kind === 'sharedPost' ? '📮 Shared a post' :
       m.kind === 'sharedReel' ? '🎬 Shared a reel' : 'Message');
    const result = await pinDMMessage(conversation, {
      messageId: m.id,
      text: preview,
      senderName: m.senderName,
      pinnedBy: user!.uid,
    });
    if (result === 'full') show('Unpin something first — max 20 pinned messages.');
  }

  async function handleCreatePoll(question: string, options: string[], allowMultiple: boolean) {
    const opts = options.map((text, i) => ({ id: String(i), text, votes: [] as string[] }));
    await send({
      kind: 'poll',
      poll: { question, options: opts, allowMultiple, closed: false, createdBy: user!.uid },
    });
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
            {!isGroup && <StudentMeritPill uid={otherId} size="micro" />}
            {isGroup ? (
              <p className="text-xs text-ink-soft">{conversation.memberIds.length} members</p>
            ) : (
              <PresenceLabel profile={otherProfile} />
            )}
          </div>
        </button>
        <button onClick={() => setMediaOpen(true)} aria-label="Media, links and shared" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
          <ImageIcon size={20} />
        </button>
        {interaction === 'open' && (
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

      <PinnedBar pinned={conversation.pinned || []} onUnpin={(id) => unpinDMMessage(conversation, id)} />

      <div ref={messageListRef} className="social-texture flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loading && <PlannerSkeleton />}
        {!loading && messages?.length === 0 && (
          <EmptyState emoji="👋" title="Say hi!" subtitle="This is the start of your conversation." />
        )}
        {!loading && !noMoreOlder && !!messages?.length && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}
        {messages?.map((m) => (
          <DMBubble
            key={m.id}
            message={{
              ...m,
              senderName: liveName(profiles, m.senderId, m.senderName),
              senderAvatar: liveAvatar(profiles, m.senderId, m.senderAvatar),
            }}
            isMine={m.senderId === user.uid}
            myUid={user.uid}
            isGroup={isGroup}
            onReact={(emoji, already) => { if (!already) sfxPop(); toggleDMReaction(conversation.id, m.id, emoji, user.uid, already); }}
            onReply={() => setReplyTo({ id: m.id, senderName: m.senderName, preview: m.text || (m.kind === 'voice' ? '🎤 Voice' : m.kind === 'image' ? '📷 Photo' : 'Shared') })}
            onDelete={() => deleteDMMessage(conversation.id, m.id)}
            onImageClick={setPreviewUrl}
            onOpenShared={onOpenShared}
            onOpenProfile={onOpenProfile}
            pinned={(conversation.pinned || []).some((p) => p.messageId === m.id)}
            onTogglePin={() => handleTogglePin(m)}
            receiptLabel={m.senderId === user.uid ? receiptLabelFor(m) : undefined}
            onVotePoll={(optionId) => { sfxSelect(); voteOnDMPoll(conversation.id, m.id, optionId, user.uid); }}
            onClosePoll={() => closeDMPoll(conversation.id, m.id)}
            onEditMessage={(newText) => editDMMessage(conversation.id, m.id, newText)}
            saved={isSaved('dmMessage', m.id)}
            onToggleSave={() => isSaved('dmMessage', m.id)
              ? unsaveItem(user.uid, 'dmMessage', m.id)
              : saveItem({ userId: user.uid, type: 'dmMessage', refId: m.id, conversationId: conversation.id, title: m.text || 'Message', imageUrl: m.imageUrl, authorName: m.senderName })}
          />
        ))}
        <div aria-hidden="true" className="h-px" />
      </div>

      <TypingIndicator names={typingNames} />

      {interaction === 'blocked' ? (
        <div className="border-t border-line bg-surface px-4 py-4 text-center text-sm text-ink-soft">
          You can't message this person.
        </div>
      ) : interaction === 'loading' ? (
        // Neutral, not accusatory: we do not yet know whether a block exists.
        // The composer stays closed so a blocked message cannot be sent in the
        // window before the block snapshots arrive.
        <div
          className="border-t border-line bg-surface px-4 py-4 text-center text-sm text-ink-soft"
          role="status"
          aria-live="polite"
        >
          Opening conversation...
        </div>
      ) : (
        <DMInput
          onSendText={(t) => send({ kind: 'text', text: t })}
          onSendImage={handleImage}
          onSendVoice={handleVoice}
          onTyping={notifyTyping}
          onCreatePoll={() => setPollOpen(true)}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          uploading={uploading}
        />
      )}

      <CreatePollSheet open={pollOpen} onClose={() => setPollOpen(false)} onCreate={handleCreatePoll} />

      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />

      {mediaOpen && (
        <MediaBrowser conversationId={conversation.id} onBack={() => setMediaOpen(false)} onOpenShared={onOpenShared} />
      )}
    </div>
  );
}
