import type { ChatMessage } from '../../types';

export default function ReactionRow({
  reactions,
  myUid,
  onToggle,
}: {
  reactions: ChatMessage['reactions'];
  myUid: string;
  onToggle: (emoji: string, alreadyReacted: boolean) => void;
}) {
  const entries = Object.entries(reactions || {}).filter(([, users]) => users.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([emoji, users]) => {
        const mine = users.includes(myUid);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji, mine)}
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
              mine ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
            }`}
          >
            <span>{emoji}</span>
            <span className="text-ink-soft">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}
