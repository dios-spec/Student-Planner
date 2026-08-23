interface EmptyStateProps {
  emoji: string;
  title: string;
  subtitle?: string;
  solid?: boolean;
}

export default function EmptyState({ emoji, title, subtitle, solid = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line px-6 py-8 text-center ${solid ? 'bg-surface' : 'bg-surface/50'}`}>
      <span className="text-3xl" aria-hidden>{emoji}</span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}
