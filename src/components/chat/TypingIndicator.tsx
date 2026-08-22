interface TypingIndicatorProps {
  names: string[];
}

export default function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  let label = '';
  if (names.length === 1) {
    label = names[0] + ' is typing…';
  } else if (names.length === 2) {
    label = names[0] + ' and ' + names[1] + ' are typing…';
  } else {
    label = names[0] + ' and ' + (names.length - 1) + ' others are typing…';
  }

  return (
    <div className="px-3 pb-1 pt-0.5">
      <p className="flex items-center gap-1.5 text-xs italic text-ink-soft">
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft" />
        </span>
        {label}
      </p>
    </div>
  );
}
