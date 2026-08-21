/** Small mood bubble shown near an avatar. Kept compact to avoid clutter. */
export default function MoodBadge({ emoji, size = 'md' }: { emoji?: string; size?: 'sm' | 'md' }) {
  if (!emoji) return null;
  const dim = size === 'sm' ? 'h-4 w-4 text-[10px]' : 'h-6 w-6 text-sm';
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 flex ${dim} items-center justify-center rounded-full border-2 border-paper bg-surface shadow-sm`}
      aria-hidden
    >
      {emoji}
    </span>
  );
}
