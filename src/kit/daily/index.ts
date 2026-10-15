/**
 * kit/daily: the hub.daily adapter (define at boot → play → complete or leave).
 * Source: dg-template src/kit/daily/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/daily.md
 *
 * Rules (hub.md "Daily challenges"):
 * - `define` is registered at boot, before any await; a day that starts
 *   before the game has mounted waits, then plays once;
 * - every way out that isn't a win calls `leave()` (the daily-puzzle kit's
 *   `cancelDaily`), or `hub.resume.save` stays blocked for the page;
 * - `complete` only while a daily is active, and only once;
 * - a `?daily=` deep link that gets no answer within 8 s goes to the title;
 * - offline (`hub:daily-error`) the day can still be played, unrecorded, from
 *   the hub's own seed (`seedForDay`), so it is the same puzzle;
 * - the isolation guard (no profile, boards or Continue writes) is kit/core's
 *   activity, set by the session while a daily plays.
 * Planned (saved-games phase 1): `challenge.saved` restores a day in progress,
 * `leave()` becomes a pause and `discard()` gives the day up.
 */
import type { DailyChallenge } from '@diffenderfer-games/hub';
import type { Clock } from '../core/clock.ts';
import { onWindow } from '../core/events.ts';
import type { HubLike } from '../core/hub-like.ts';
import { field, isJson, type Json, type JsonObject } from '../core/json.ts';
import { cancelDaily, inDaily } from '../daily-puzzle/hub.ts';
import { seedForDay } from '../rng/index.ts';

/** A day to play, as the session receives it. */
export type DailyStart = {
  day: string;
  seed: number;
  /** False when the hub couldn't start it (offline): played for fun, nothing recorded. */
  recorded: boolean;
  /** Planned (saved-games phase 1): the state saved for this day, to restore. */
  saved: Json | null;
};

/** How the kit handles the day. */
export type DailyOptions = {
  slug: string;
  clock: Clock;
  events: EventTarget;
  /** Start the day (the session builds the game from the seed). Called after `ready()`. */
  onPlay(start: DailyStart): void;
  /** Offline: play the day unrecorded (default), or just tell the player. */
  offline?: 'play-unrecorded' | 'toast';
  /** Tell the player something (offline, queued). */
  notify(kind: 'offline' | 'queued'): void;
  /** A `?daily=` deep link got no day within `deepLinkMs`: show the title. */
  onDeepLinkTimeout(): void;
  /** The page's search string (default: location.search). */
  search?: string;
  deepLinkMs?: number;
};

/** The daily adapter. */
export type DailyHandle = {
  /** The day being played (recorded or not), or null. */
  readonly current: DailyStart | null;
  /** The game has mounted: play a queued day now. */
  ready(): void;
  /** Won: record it with `meta` (once). False when nothing was active. */
  complete(meta: JsonObject): boolean;
  /** Any other way out (quit, new game, title, launch, race): end it unrecorded. */
  leave(): void;
  /** Planned: give this day up (falls back to `leave`). */
  discard(): void;
};

/** Register the daily with the hub (synchronously) and return the adapter. */
export function installDaily(hub: Pick<HubLike, 'daily'>, o: DailyOptions): DailyHandle {
  let mounted = false;
  let queued: DailyStart | null = null;
  let current: DailyStart | null = null;
  let completed = false;

  const play = (start: DailyStart): void => {
    if (!mounted) {
      queued = start;
      return;
    }
    current = start;
    completed = false;
    o.onPlay(start);
  };

  hub.daily.define({
    play(ch: DailyChallenge) {
      const saved = field(ch, 'saved');
      play({ day: ch.day, seed: ch.seed, recorded: true, saved: isJson(saved) ? saved : null });
    },
  });

  onWindow(
    'hub:daily-error',
    (d) => {
      o.notify('offline');
      if ((o.offline ?? 'play-unrecorded') === 'toast' || !/^\d{4}-\d{2}-\d{2}$/.test(d.day)) return;
      play({ day: d.day, seed: seedForDay(o.slug, d.day), recorded: false, saved: null });
    },
    o.events,
  );
  onWindow('hub:daily-queued', () => o.notify('queued'), o.events);

  const deepDay = new URLSearchParams(o.search ?? (typeof location === 'undefined' ? '' : location.search)).get(
    'daily',
  );
  if (deepDay !== null) {
    o.clock.after(o.deepLinkMs ?? 8000, () => {
      if (current === null && queued === null) o.onDeepLinkTimeout();
    });
  }

  return {
    get current() {
      return current;
    },
    ready() {
      mounted = true;
      const q = queued;
      queued = null;
      if (q) play(q);
    },
    complete(meta) {
      if (completed || current === null) return false;
      completed = true;
      const wasRecorded = current.recorded;
      current = null;
      if (!wasRecorded || !inDaily(hub.daily)) return false;
      void hub.daily.complete(meta);
      return true;
    },
    leave() {
      current = null;
      cancelDaily(hub.daily);
    },
    discard() {
      current = null;
      if (hub.daily.discard) hub.daily.discard();
      else cancelDaily(hub.daily);
    },
  };
}
