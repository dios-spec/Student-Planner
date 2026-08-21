import { useRef, useState } from 'react';
import { Send, ImagePlus, Smile, Mic, X } from 'lucide-react';
import EmojiPicker from '../chat/EmojiPicker';
import VoiceRecorderBar from './VoiceRecorderBar';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { MAX_MESSAGE_LENGTH, containsBlockedLanguage, isRateLimited } from '../../utils/moderation';
import type { DMMessage } from '../../types';

interface DMInputProps {
  onSendText: (text: string) => void;
  onSendImage: (file: File) => void;
  onSendVoice: (blob: Blob, duration: number) => void;
  replyTo: DMMessage['replyTo'];
  onCancelReply: () => void;
  uploading: boolean;
}

export default function DMInput({
  onSendText, onSendImage, onSendVoice, replyTo, onCancelReply, uploading,
}: DMInputProps) {
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rec = useVoiceRecorder();

  function send() {
    const t = text.trim();
    if (!t) return;
    if (isRateLimited('dm-send')) { setWarning('Slow down a moment.'); return; }
    if (containsBlockedLanguage(t)) { setWarning("Let's keep it friendly."); return; }
    onSendText(t);
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
            Replying to <span className="font-semibold">{replyTo.senderName}</span>: {replyTo.preview}
          </span>
          <button onClick={onCancelReply} aria-label="Cancel reply"><X size={14} /></button>
        </div>
      )}

      {picker && (
        <div className="mb-2">
          <EmojiPicker onPick={(e) => { setText((t) => t + e); setPicker(false); }} />
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSendImage(f);
            e.target.value = '';
          }}
        />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Image"
          className="shrink-0 rounded-full p-2.5 text-ink-soft hover:bg-surface-alt disabled:opacity-50">
          <ImagePlus size={20} />
        </button>
        <button onClick={() => setPicker((o) => !o)} aria-label="Emoji"
          className="shrink-0 rounded-full p-2.5 text-ink-soft hover:bg-surface-alt">
          <Smile size={20} />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 640) { e.preventDefault(); send(); }
          }}
          rows={1}
          placeholder="Message…"
          className="max-h-24 flex-1 resize-none rounded-2xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        {text.trim() ? (
          <button onClick={send} aria-label="Send" className="shrink-0 rounded-full bg-accent p-2.5 text-white">
            <Send size={18} />
          </button>
        ) : (
          <button onClick={rec.start} aria-label="Record voice" className="shrink-0 rounded-full bg-accent p-2.5 text-white">
            <Mic size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
