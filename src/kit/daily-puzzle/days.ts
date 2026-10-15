/**
 * daily-puzzle kit: UTC day keys (`YYYY-MM-DD`), as the hub uses them.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Is `s` a real `YYYY-MM-DD` day? */
export function isDayKey(s: string): boolean {
  if (!DAY_RE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

function dayStart(day: string): number {
  if (!isDayKey(day)) throw new RangeError(`not a day key: ${day}`);
  return Date.parse(`${day}T00:00:00Z`);
}

/** The UTC day of a timestamp (default: now). */
export function todayUTC(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** `day` moved by `n` days (negative goes back). */
export function addDays(day: string, n: number): string {
  return todayUTC(dayStart(day) + n * DAY_MS);
}

/** Whole days from `a` to `b` (`b` later is positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayStart(b) - dayStart(a)) / DAY_MS);
}

/** `count` consecutive days from `start`, oldest first. */
export function dayRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
