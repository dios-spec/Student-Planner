interface AvatarProps {
  name: string;
  src?: string;
  emoji?: string;
  size?: 'sm' | 'md' | 'lg' | 'story';
}

const SIZES = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-20 w-20 text-3xl',
  story: 'h-16 w-16 text-2xl',
};

const PALETTE = ['#4A55E1', '#E15B45', '#2F9E68', '#D98A2E', '#E0568C', '#12A594'];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function Avatar({ name, src, emoji, size = 'md' }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`${SIZES[size]} aspect-square max-w-none shrink-0 rounded-full object-cover ring-2 ring-surface`}
      />
    );
  }
  return (
    <div
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white ring-2 ring-surface`}
      style={{ backgroundColor: colorFor(name || '?') }}
      aria-label={name}
    >
      {emoji || name.charAt(0).toUpperCase()}
    </div>
  );
}
