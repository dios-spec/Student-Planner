import { format, addDays, isToday, isTomorrow, differenceInCalendarDays, parseISO } from 'date-fns';
import type { TimetableDayKey } from '../types';

export const DATE_FMT = 'yyyy-MM-dd';

export function toDateKey(d: Date): string {
  return format(d, DATE_FMT);
}

export function fromDateKey(key: string): Date {
  return parseISO(key);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function shiftDateKey(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days));
}

export function friendlyDate(key: string): string {
  const d = fromDateKey(key);
  return format(d, 'EEEE, d MMMM');
}

export function relativeDayLabel(key: string): string {
  const d = fromDateKey(key);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  const diff = differenceInCalendarDays(d, new Date());
  if (diff > 0 && diff < 7) return format(d, 'EEEE');
  return format(d, 'd MMM');
}

export function daysLeftLabel(key: string): string {
  const diff = differenceInCalendarDays(fromDateKey(key), new Date());
  if (diff < 0) return 'Past due';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${diff} days left`;
}

export function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return format(date, 'd MMM');
}

export function todayDayKey(): TimetableDayKey | null {
  const map: Record<number, TimetableDayKey> = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
  return map[new Date().getDay()] ?? null;
}
