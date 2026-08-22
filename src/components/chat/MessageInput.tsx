import { useRef, useState } from 'react';
import { Send, ImagePlus, Smile, Mic, X } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import VoiceRecorderBar from '../dm/VoiceRecorderBar';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { MAX_MESSAGE_LENGTH, containsBlockedLanguage, isRateLimited } from '../../utils/moderation';
import type { ChatMessage } from '../../types';

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendImage: (file: File) => void;
  onSendVoice: (blob: Blob, duration: number) => void;
  onTyping?: () => void;
  replyTo: ChatMessage['replyTo'];
  onCancelReply: () => void;
  uploading: boolean;
}

export default function MessageInput({ onSend, onSendImage, onSendVoice, onTyping, replyTo, onCancelReply, uploading }: MessageInputProps) {
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rec = useVoiceRecorder();

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isRateLimited('chat-send')) {
      setWarning('Slow down a bit before sending again.');
      return;
    }
    if (containsBlockedLanguage(trimmed)) {
      setWarning("Let's keep the chat friendly — message not sent.");
      return;
    }
    onSend(trimmed);
    setText('');
    setWarning(null);
  }

  async function stopAndSend() {
    const { blob, duration } = await rec.stop();
    if (blob && duration >= 1) onSendVoice(blob, duration);
  }

  if (rec.recording) {
    return (
      <div className="border-t border-line bg-surface px-3 py-2">
        <VoiceRecorderBar seconds={rec.seconds} onCancel={rec.cancel} onSend={stopAndSend} />
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-surface px-3 py-2">
      {warning && <p className="mb-1.5 px-1 text-xs font-medium text-coral">{warning}</p>}
      {rec.error && <p className="mb-1.5 px-1 text-xs font-medium text-coral">{rec.error}</p>}

      {replyTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-surface-alt px-3 py-1.5 text-xs">
          <span className="truncate text-ink-soft">
            Replying to <span className="font-semibold">{replyTo.senderName}</span>: {replyTo.text || 'Photo'}
          </span>
          <button onClick={onCancelReply} aria-label="Cancel reply">
            <X size={14} />
          </button>
        </div>
      )}

      {pickerOpen && (
        <div className="mb-2">
          <EmojiPicker
            onPick={(e) => {
              setText((t) => t + e);
              setPickerOpen(false);
            }}
          />
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSendImage(file);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Attach image"
          className="shrink-0 rounded-full p-2.5 text-ink-soft hover:bg-surface-alt disabled:opacity-50"
        >
          <ImagePlus size={20} />
        </button>
        <button
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Emoji"
          className="shrink-0 rounded-full p-2.5 text-ink-soft hover:bg-surface-alt"
        >
          <Smile size={20} />
        </button>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, MAX_MESSAGE_LENGTH));
            onTyping?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 640) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="Message the class…"
          className="max-h-24 flex-1 resize-none rounded-2xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        {text.trim() ? (
          <button onClick={handleSend} aria-label="Send" className="shrink-0 rounded-full bg-accent p-2.5 text-white">
            <Send size={18} />
          </button>
        ) : (
          <button
            onClick={rec.start}
            disabled={uploading}
            aria-label="Record voice"
            className="shrink-0 rounded-full bg-accent p-2.5 text-white disabled:opacity-50"
          >
            <Mic size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
