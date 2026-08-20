import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { friendlyDate, shiftDateKey, todayKey } from '../../utils/date';

interface DateHeaderProps {
  dateKey: string;
  onChange: (key: string) => void;
}

export default function DateHeader({ dateKey, onChange }: DateHeaderProps) {
  const isToday = dateKey === todayKey();

  return (
    <div className="spiral-rail rounded-3xl border border-line bg-surface px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          aria-label="Previous day"
          onClick={() => onChange(shiftDateKey(dateKey, -1))}
          className="rounded-full p-2 text-ink-soft hover:bg-surface-alt active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex flex-1 flex-col items-center">
          <span className="font-display text-base font-semibold text-ink sm:text-lg">
            {friendlyDate(dateKey)}
          </span>
          {!isToday && (
            <button onClick={() => onChange(todayKey())} className="mt-0.5 text-xs font-semibold text-accent">
              Jump to Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <label className="relative rounded-full p-2 text-ink-soft hover:bg-surface-alt">
            <CalendarDays size={20} />
            <input
              type="date"
              value={dateKey}
              onChange={(e) => e.target.value && onChange(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Pick a date"
            />
          </label>
          <button
            aria-label="Next day"
            onClick={() => onChange(shiftDateKey(dateKey, 1))}
            className="rounded-full p-2 text-ink-soft hover:bg-surface-alt active:scale-95"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
