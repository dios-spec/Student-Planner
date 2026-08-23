import { useState } from 'react';
import { SmilePlus, Reply, Trash2, Flag, Pin, PinOff, Pencil, Bookmark } from 'lucide-react';
import type { ChatMessage } from '../../types';
import Avatar from '../shared/Avatar';
import EmojiPicker from './EmojiPicker';
import ReactionRow from './ReactionRow';
import VoicePlayer from '../dm/VoicePlayer';
import StudentMeritPill from '../merit/StudentMeritPill';
import PollCard from './PollCard';
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
  onOpenProfile: (uid: string) => void;
  pinned: boolean;
  onTogglePin: () => void;
  onVotePoll: (optionId: string) => void;
  onClosePoll: () => void;
  onEditMessage: (newText: string) => void;
  saved: boolean;
  onToggleSave: () => void;
  hidePinAndSave?: boolean;
}

export default function MessageBubble({
  message, isMine, myUid, onReact, onReply, onDelete, onReport, onImageClick, onOpenProfile,
  pinned, onTogglePin, onVotePoll, onClosePoll, onEditMessage, saved, onToggleSave, hidePinAndSave = false,
}: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const createdDate = message.createdAt?.toDate ? message.createdAt.toDate() : new Date();
  const canEdit = isMine && !!message.text && !message.imageUrl && !message.audioUrl && !message.poll;

  if (message.deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <p className="italic text-xs text-ink-soft px-3 py-1">Message deleted</p>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      {!isMine && (
        <button onClick={() => onOpenProfile(message.senderId)} aria-label={`View ${message.senderName}'s profile`}>
          <Avatar name={message.senderName} src={message.senderAvatar} size="sm" />
        </button>
      )}
      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMine && (
          <div className="mb-0.5 flex flex-wrap items-center gap-1 px-1">
            <button onClick={() => onOpenProfile(message.senderId)} className="text-xs font-semibold text-ink-soft">
              {message.senderName}
            </button>
            <StudentMeritPill uid={message.senderId} size="micro" />
          </div>
        )}

        {message.replyTo && (
          <div className="mb-1 max-w-full truncate rounded-lg border-l-2 border-accent bg-surface-alt px-2 py-1 text-xs text-ink-soft">
            <span className="font-semibold">{message.replyTo.senderName}: </span>
            {message.replyTo.text || 'Photo'}
          </div>
        )}

        <div className={`relative rounded-2xl px-3.5 py-2.5 text-sm ${isMine ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm bg-surface text-ink'}`}>
          {message.imageUrl && (
            <img src={message.imageUrl} alt="Shared" onClick={() => onImageClick(message.imageUrl!)} className="mb-1 max-h-56 w-full cursor-pointer rounded-xl object-cover" />
          )}
          {message.audioUrl && <VoicePlayer url={message.audioUrl} duration={message.audioDuration} mine={isMine} />}
          {message.poll && (
            <PollCard poll={message.poll} myUid={myUid} mine={isMine} onVote={onVotePoll} onClose={message.poll.createdBy === myUid ? onClosePoll : undefined} />
          )}
          {editing ? (
            <div className="space-y-1.5">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value.slice(0, 500))}
                rows={2}
                autoFocus
                className={`w-full resize-none rounded-lg border px-2 py-1.5 text-sm outline-none ${isMine ? 'border-white/30 bg-white/10 text-white' : 'border-line bg-paper text-ink'}`}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className={`rounded-full px-3 py-1 text-xs font-medium ${isMine ? 'text-white/80' : 'text-ink-soft'}`}>Cancel</button>
                <button
                  onClick={() => { if (editText.trim()) { onEditMessage(editText.trim()); setEditing(false); } }}
                  disabled={!editText.trim()}
                  className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${isMine ? 'bg-white text-accent' : 'bg-accent text-white'}`}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-2 px-1">
          <span className="text-[11px] text-ink-soft">{relativeTime(createdDate)}{message.edited ? ' · edited' : ''}</span>
          <button onClick={() => setPickerOpen((o) => !o)} className="text-ink-soft hover:text-accent"><SmilePlus size={14} /></button>
          <button onClick={onReply} className="text-ink-soft hover:text-accent"><Reply size={14} /></button>
          <button onClick={() => setMenuOpen((o) => !o)} className="text-ink-soft hover:text-accent">•••</button>
        </div>

        {pickerOpen && (
          <div className="mt-1">
            <EmojiPicker onPick={(emoji) => { const already = (message.reactions?.[emoji] || []).includes(myUid); onReact(emoji, already); setPickerOpen(false); }} />
          </div>
        )}

        {menuOpen && (
          <div className="mt-1 overflow-hidden rounded-xl border border-line bg-surface text-xs shadow-lg">
            {!hidePinAndSave && (
              <>
                <button onClick={() => { setMenuOpen(false); onTogglePin(); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt">
                  {pinned ? <PinOff size={13} /> : <Pin size={13} />} {pinned ? 'Unpin' : 'Pin'}
                </button>
                <button onClick={() => { setMenuOpen(false); onToggleSave(); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt">
                  <Bookmark size={13} className={saved ? 'fill-current' : ''} /> {saved ? 'Unsave' : 'Save'}
                </button>
              </>
            )}
            {canEdit && (
              <button onClick={() => { setMenuOpen(false); setEditText(message.text || ''); setEditing(true); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt">
                <Pencil size={13} /> Edit
              </button>
            )}
            {isMine ? (
              <button onClick={() => { setMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-coral hover:bg-coral-soft">
                <Trash2 size={13} /> Delete
              </button>
            ) : (
              <button onClick={() => { setMenuOpen(false); onReport(); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt">
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
