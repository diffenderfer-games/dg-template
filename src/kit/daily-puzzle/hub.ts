/**
 * daily-puzzle kit: the bridge to `hub.daily` (complete on a win, cancel on leave).
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * It only needs the shape of `hub.daily` (pass `hub.daily` itself), so the kit
 * doesn't import the hub client. The rules it keeps:
 * - `complete` only while a daily run is active, once, with the standard meta
 *   (`score`, `stars`, `attempts`, `gen`, `line`, plus the game's own fields);
 * - `cancel` on every way out that isn't a win (quit, a normal game, a room);
 * - a daily run never touches normal progress: the game checks `inDaily`
 *   before it saves a run, submits a score or bumps a stat.
 */
import type { Stars } from './attempts.ts';
import type { Json, JsonObject } from './json.ts';

/** The part of `hub.daily` the kit uses. */
export type DailyHub = {
  readonly active: { readonly day: string; readonly seed: number } | null;
  complete(meta: JsonObject): void;
  cancel(): void;
};

/** A win, as the kit reports it. */
export type DailyWin = {
  stars: Stars;
  attempts: number;
  /** The generator version that built the puzzle. */
  gen: number;
  /** The winning action list (replayable with the same generator version). */
  line?: Json[];
  /** The game's own fields (`phase`, `n`, `mode`…). They can't replace the standard ones. */
  extra?: JsonObject;
};

/** The `hub.daily.complete` metadata for a win: `score` is the stars, so the day's board ranks by them. */
export function winMeta(win: DailyWin): JsonObject {
  const meta: JsonObject = { ...(win.extra ?? {}), score: win.stars, stars: win.stars, attempts: win.attempts, gen: win.gen };
  if (win.line) meta.line = win.line;
  return meta;
}

/** Is a daily run active (for `day`, when given)? */
export function inDaily(daily: DailyHub, day?: string): boolean {
  return daily.active !== null && (day === undefined || daily.active.day === day);
}

/** Record the active day as won. Returns false when no daily run was active (nothing sent). */
export function completeDaily(daily: DailyHub, win: DailyWin): boolean {
  if (!daily.active) return false;
  daily.complete(winMeta(win));
  return true;
}

/** End the active daily run without recording it (the player left). Safe to call any time. */
export function cancelDaily(daily: DailyHub): void {
  if (daily.active) daily.cancel();
}
