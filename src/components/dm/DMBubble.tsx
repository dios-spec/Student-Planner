import { useState } from 'react';
import { SmilePlus, Reply, Trash2, Pin } from 'lucide-react';
import Avatar from '../shared/Avatar';
import EmojiPicker from '../chat/EmojiPicker';
import ReactionRow from '../chat/ReactionRow';
import VoicePlayer from './VoicePlayer';
import SharedPreview from './SharedPreview';
import { relativeTime } from '../../utils/date';
import type { DMMessage } from '../../types';

interface DMBubbleProps {
  message: DMMessage;
  isMine: boolean;
  myUid: string;
  isGroup: boolean;
  onReact: (emoji: string, already: boolean) => void;
  onReply: () => void;
  onDelete: () => void;
  onImageClick: (url: string) => void;
  onOpenShared: (shared: NonNullable<DMMessage['shared']>) => void;
  onOpenProfile: (uid: string) => void;
  pinned: boolean;
  onTogglePin: () => void;
}

export default function DMBubble({
  message, isMine, myUid, isGroup,
  onReact, onReply, onDelete, onImageClick, onOpenShared, onOpenProfile,
  pinned, onTogglePin,
}: DMBubbleProps) {
  const [picker, setPicker] = useState(false);
  const created = message.createdAt?.toDate ? message.createdAt.toDate() : new Date();

  if (message.deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <p className="px-3 py-1 text-xs italic text-ink-soft">Message deleted</p>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      {!isMine && isGroup && (
        <button onClick={() => onOpenProfile(message.senderId)}>
          <Avatar name={message.senderName} src={message.senderAvatar} size="sm" />
        </button>
      )}
      <div className={`flex max-w-[78%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && isGroup && (
          <button onClick={() => onOpenProfile(message.senderId)} className="mb-0.5 px-1 text-xs font-semibold text-ink-soft">
            {message.senderName}
          </button>
        )}

        {message.replyTo && (
          <div className="mb-1 max-w-full truncate rounded-lg border-l-2 border-accent bg-surface-alt px-2 py-1 text-xs text-ink-soft">
            <span className="font-semibold">{message.replyTo.senderName}: </span>
            {message.replyTo.preview}
          </div>
        )}

        <div
          className={`relative rounded-2xl px-3 py-2 text-sm ${
            isMine ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm bg-surface text-ink'
          } ${message.kind === 'voice' ? 'min-w-[180px]' : ''}`}
        >
          {message.kind === 'image' && message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Shared"
              onClick={() => onImageClick(message.imageUrl!)}
              className="mb-1 max-h-60 w-full cursor-pointer rounded-xl object-cover"
            />
          )}
          {message.kind === 'voice' && message.audioUrl && (
            <VoicePlayer url={message.audioUrl} duration={message.audioDuration} mine={isMine} />
          )}
          {(message.kind === 'sharedPost' || message.kind === 'sharedReel') && message.shared && (
            <SharedPreview shared={message.shared} mine={isMine} onOpen={() => onOpenShared(message.shared!)} />
          )}
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
        </div>

        <div className="mt-0.5 flex items-center gap-2 px-1">
          <span className="text-[11px] text-ink-soft">{relativeTime(created)}</span>
          <button onClick={() => setPicker((o) => !o)} className="text-ink-soft hover:text-accent">
            <SmilePlus size={14} />
          </button>
          <button onClick={onReply} className="text-ink-soft hover:text-accent">
            <Reply size={14} />
          </button>
          <button onClick={onTogglePin} aria-label={pinned ? 'Unpin' : 'Pin'} className={pinned ? 'text-accent' : 'text-ink-soft hover:text-accent'}>
            <Pin size={13} className={pinned ? 'fill-accent' : ''} />
          </button>
          {isMine && (
            <button onClick={onDelete} className="text-ink-soft hover:text-coral">
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {picker && (
          <div className="mt-1">
            <EmojiPicker
              onPick={(emoji) => {
                const already = (message.reactions?.[emoji] || []).includes(myUid);
                onReact(emoji, already);
                setPicker(false);
              }}
            />
          </div>
        )}

        <ReactionRow reactions={message.reactions} myUid={myUid} onToggle={onReact} />
      </div>
    </div>
  );
}
