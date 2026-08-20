import { useState } from 'react';
import { Plus, Trash2, StickyNote } from 'lucide-react';
import { useMyNotes } from '../../hooks/useMyNotes';
import { addNote, deleteNote, toggleNote } from '../../firebase/notes';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../shared/EmptyState';
import { MAX_NOTE_LENGTH } from '../../utils/moderation';

export default function MyNotes() {
  const { user } = useAuth();
  const { notes, loading } = useMyNotes(user?.uid);
  const [text, setText] = useState('');

  async function handleAdd() {
    if (!user || !text.trim()) return;
    await addNote(user.uid, text.trim().slice(0, MAX_NOTE_LENGTH));
    setText('');
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <StickyNote size={17} className="text-ink-soft" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">My Notes</h3>
      </div>
      <p className="mb-2 px-1 text-xs text-ink-soft">Private to you — nobody else can see these.</p>

      <div className="mb-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Ask teacher about worksheet…"
          maxLength={MAX_NOTE_LENGTH}
          className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button onClick={handleAdd} disabled={!text.trim()} className="rounded-xl bg-accent px-3 text-white disabled:opacity-40">
          <Plus size={18} />
        </button>
      </div>

      {!loading && (notes?.length ?? 0) === 0 && <EmptyState emoji="📝" title="No personal notes yet" />}

      <div className="space-y-2">
        {notes?.map((note) => (
          <div key={note.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
            <input
              type="checkbox"
              checked={!!note.done}
              onChange={(e) => toggleNote(note.id, e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className={`flex-1 text-sm text-ink ${note.done ? 'text-ink-soft line-through' : ''}`}>
              {note.text}
            </span>
            <button onClick={() => deleteNote(note.id)} aria-label="Delete note" className="text-ink-soft hover:text-coral">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
