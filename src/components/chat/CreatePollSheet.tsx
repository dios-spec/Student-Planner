import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Modal from '../shared/Modal';

interface CreatePollSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[], allowMultiple: boolean) => void;
}

export default function CreatePollSheet({ open, onClose, onCreate }: CreatePollSheetProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);

  function reset() {
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
  }

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value.slice(0, 80) : o)));
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && validOptions.length >= 2;

  function handleCreate() {
    if (!canCreate) return;
    onCreate(question.trim().slice(0, 200), validOptions, allowMultiple);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New Poll">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
            placeholder="What chapter is tomorrow's test?"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={'Option ' + (i + 1)}
                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} aria-label="Remove option" className="text-ink-soft">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button onClick={addOption} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-accent">
              <Plus size={16} /> Add option
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-accent"
          />
          Allow selecting multiple options
        </label>

        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Create Poll
        </button>
      </div>
    </Modal>
  );
}
