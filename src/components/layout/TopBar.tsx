import { type ReactNode } from 'react';

export default function TopBar({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-3 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="font-display text-lg font-semibold text-ink">{title}</div>
      {right}
    </header>
  );
}
