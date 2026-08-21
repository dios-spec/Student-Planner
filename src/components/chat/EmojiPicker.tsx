const EMOJIS = [
  // faces
  '😀','😁','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😜','🤪','🤔','🤨','😐',
  '😴','😌','😎','🥳','😏','😢','😭','😤','😡','🤯','😱','😨','😳','🥺','😬','🙄',
  '😷','🤒','🤢','🤮','🥴','😵','🤠','🤗','🤫','🤭','😶','😑','😒','🙃','😋','🤤',
  // gestures / people
  '👍','👎','👌','🤌','✌️','🤞','🤙','👏','🙌','🙏','💪','🫡','👀','🫶','🤝','☝️',
  // hearts / symbols
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💯','🔥','⭐','✨','💫','⚡','💥','❗',
  '✅','❌','⁉️','❓','💬','💤','🎉','🎊','🏆','🥇','👑','💎','🎯','🚀','💡','📌',
  // school / stuff
  '📚','📖','📝','✏️','📐','🧮','🎒','🖊️','📎','📅','⏰','🔔','💻','📱','🎮','🎨',
  // fun / animals / food
  '⚽','🏀','🏏','🎸','🎵','🍕','🍔','🍟','🍦','🍩','☕','🧋','🐶','🐱','🦊','🐼',
];

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-lg">
      {EMOJIS.map((e, i) => (
        <button
          key={`${e}-${i}`}
          onClick={() => onPick(e)}
          className="rounded-lg p-1.5 text-xl hover:bg-surface-alt active:scale-90"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
