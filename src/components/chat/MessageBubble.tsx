import { useState } from 'react';
import { SmilePlus, Reply, Trash2, Flag } from 'lucide-react';
import type { ChatMessage } from '../../types';
import Avatar from '../shared/Avatar';
import EmojiPicker from './EmojiPicker';
import ReactionRow from './ReactionRow';
import { relativeTime } from '../../utils/date';

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  myUid: string;
  onReact: (emoji: string, alreadyReacted: boolean) => void;
  onReply: () => void;
  onDelete: () => void;
  onReport: () => void;
  onImageClick: (url: string) => void;
}

export default function MessageBubble({
  message,
  isMine,
  myUid,
  onReact,
  onReply,
  onDelete,
  onReport,
  onImageClick,
}: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const createdDate = message.createdAt?.toDate ? message.createdAt.toDate() : new Date();

  if (message.deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <p className="italic text-xs text-ink-soft px-3 py-1">Message deleted</p>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      {!isMine && <Avatar name={message.senderName} src={message.senderAvatar} size="sm" />}
      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMine && <span className="mb-0.5 px-1 text-xs font-semibold text-ink-soft">{message.senderName}</span>}

        {message.replyTo && (
          <div className="mb-1 max-w-full truncate rounded-lg border-l-2 border-accent bg-surface-alt px-2 py-1 text-xs text-ink-soft">
            <span className="font-semibold">{message.replyTo.senderName}: </span>
            {message.replyTo.text || 'Photo'}
          </div>
        )}

        <div
          className={`relative rounded-2xl px-3.5 py-2.5 text-sm ${
            isMine ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm bg-surface text-ink'
          }`}
        >
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Shared"
              onClick={() => onImageClick(message.imageUrl!)}
              className="mb-1 max-h-56 w-full cursor-pointer rounded-xl object-cover"
            />
          )}
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
        </div>

        <div className="mt-0.5 flex items-center gap-2 px-1">
          <span className="text-[11px] text-ink-soft">{relativeTime(createdDate)}</span>
          <button onClick={() => setPickerOpen((o) => !o)} className="text-ink-soft hover:text-accent">
            <SmilePlus size={14} />
          </button>
          <button onClick={onReply} className="text-ink-soft hover:text-accent">
            <Reply size={14} />
          </button>
          <button onClick={() => setMenuOpen((o) => !o)} className="text-ink-soft hover:text-accent">
            •••
          </button>
        </div>

        {pickerOpen && (
          <div className="mt-1">
            <EmojiPicker
              onPick={(emoji) => {
                const already = (message.reactions?.[emoji] || []).includes(myUid);
                onReact(emoji, already);
                setPickerOpen(false);
              }}
            />
          </div>
        )}

        {menuOpen && (
          <div className="mt-1 overflow-hidden rounded-xl border border-line bg-surface text-xs shadow-lg">
            {isMine ? (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-coral hover:bg-coral-soft"
              >
                <Trash2 size={13} /> Delete
              </button>
            ) : (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onReport();
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt"
              >
                <Flag size={13} /> Report
              </button>
            )}
          </div>
        )}

        <ReactionRow reactions={message.reactions} myUid={myUid} onToggle={onReact} />
      </div>
    </div>
  );
}
