import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNowStrict,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { IsoDate, IsoInstant } from '@/types/api';

/**
 * Calendar dates (IsoDate) are workspace-local days and are handled as plain dates — never converted through a
 * timezone — so a task due on the 4th shows on the 4th for every viewer. Instants are formatted in the viewer's zone.
 */
export function parseDate(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

export function shiftDate(date: IsoDate, days: number): IsoDate {
  return toIsoDate(addDays(parseDate(date), days));
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(parseDate(to), parseDate(from));
}

export function formatDay(date: IsoDate | null | undefined, pattern = 'd MMM'): string {
  if (!date) return '';
  return format(parseDate(date), pattern);
}

export function formatDayLong(date: IsoDate): string {
  return format(parseDate(date), 'EEEE d MMMM yyyy');
}

export function formatInstant(value: IsoInstant | null | undefined, pattern = 'd MMM yyyy, HH:mm'): string {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, pattern) : '';
}

export function relativeTime(value: IsoInstant | null | undefined): string {
  if (!value) return 'never';
  const d = parseISO(value);
  return isValid(d) ? `${formatDistanceToNowStrict(d)} ago` : '';
}

/** Weeks start on Monday. Returns the full grid (whole weeks) covering the month of `anchor`. */
export function monthGrid(anchor: IsoDate): IsoDate[] {
  const start = startOfWeek(startOfMonth(parseDate(anchor)), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(parseDate(anchor)), { weekStartsOn: 1 });
  const out: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(toIsoDate(d));
  return out;
}

export function weekDays(anchor: IsoDate): IsoDate[] {
  const start = startOfWeek(parseDate(anchor), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(start, i)));
}

export function isSameMonth(a: IsoDate, b: IsoDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function todayLocal(): IsoDate {
  return toIsoDate(new Date());
}
