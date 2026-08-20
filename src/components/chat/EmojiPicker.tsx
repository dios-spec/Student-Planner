const EMOJIS = ['😀','😂','😭','💀','🔥','❤️','👍','👎','✅','❌','📚','📝','🎒','⚽','🎉','😅','🤔','👀'];

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1 rounded-2xl border border-line bg-surface p-2 shadow-lg">
      {EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => onPick(e)}
          className="rounded-lg p-2 text-xl hover:bg-surface-alt active:scale-90"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
