/**
 * kit/race: the hub.race adapter (a single-player game goes multiplayer).
 * Source: dg-template src/kit/race/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/race.md
 *
 * Rules (multiplayer.md §14):
 * - `define` at boot; spectators get no `start`;
 * - the game is built from the seed and params only (fair);
 * - input is locked until `startAt` and after `end`;
 * - a reload (`resumed: true`) restores the player's progress from a
 *   sessionStorage stash keyed by room and round (arrow-escape raceSave);
 * - status is throttled to 4 per second; `finish` / `lose` are sent once;
 * - never paused (the pause button asks "Leave race?"); races write history
 *   only, never boards or stats (kit/scores);
 * - stats are numbers, booleans or `#rrggbb`, never text.
 */
import type { RaceParams, RaceResult, RaceStart, RaceStats } from '@diffenderfer-games/hub';
import type { Clock } from '../core/clock.ts';
import { fireAndForget } from '../core/async.ts';
import type { HubLike } from '../core/hub-like.ts';
import { isJson, type Json } from '../core/json.ts';
import { ruleBroken } from '../core/log.ts';
import type { Store } from '../core/store.ts';
import { errText } from '../online/errors.ts';

/** Status reports at most this often (the hub coalesces to 4/s too). */
export const RACE_STATUS_MS = 250;

/** What the session gives the race adapter. */
export type RaceOptions<R extends Json> = {
  slug: string;
  clock: Clock;
  /** sessionStorage (a reload keeps it; a new tab doesn't). */
  stash: Store;
  /** A race starts (or restarts after a reload, with the stashed game). */
  onStart(race: RaceStart, restored: R | null): void;
  /** Decided: lock input (the hub shows the result card). */
  onEnd(result: RaceResult): void;
  /** The player pressed Done, or the race closed: back to the title. */
  onExit(): void;
  /** Tell the player something (a failed create). */
  notify(text: string): void;
  isRun(x: Json): x is R;
};

/** The race adapter. */
export type RaceHandle<R extends Json> = {
  readonly live: boolean;
  readonly current: RaceStart | null;
  /** Is input locked now (before the go, after the end)? */
  locked(): boolean;
  /** Report live stats (throttled) and keep a stash for a reload. */
  report(run: R, stats: RaceStats, progress?: number): void;
  /** The player finished (won), once. */
  finish(stats: RaceStats): void;
  /** The player is out, once. */
  lose(stats: RaceStats): void;
  /** Leave the race ("Leave race?" → yes). */
  leave(): void;
  create(params?: RaceParams): void;
  browse(): void;
  history(): void;
};

/** A stat value is a number, a boolean or a `#rrggbb` colour: never text (bad_stats). */
export function checkStats(stats: RaceStats): RaceStats {
  const entries = Object.entries(stats);
  if (entries.length > 12) ruleBroken(`race stats: ${entries.length} keys (at most 12)`);
  for (const [k, v] of entries) {
    if (typeof v === 'string' && !/^#[0-9a-fA-F]{6}$/.test(v))
      ruleBroken(`race stat "${k}" is text; stats are numbers, booleans or #rrggbb`);
  }
  return stats;
}

/** Register the race with the hub (synchronously) and return the adapter. */
export function installRace<R extends Json>(hub: Pick<HubLike, 'race'>, o: RaceOptions<R>): RaceHandle<R> {
  let current: RaceStart | null = null;
  let ended = false;
  let sent = false;
  let lastStatus = -Infinity;
  const key = (r: RaceStart): string => `${o.slug}:race:${r.roomId}:${r.round}`;

  hub.race.define({
    start(r) {
      if (r.spectator) return;
      current = r;
      ended = false;
      sent = false;
      let restored: R | null = null;
      if (r.resumed) {
        const saved = o.stash.getJson(key(r));
        restored = saved !== undefined && isJson(saved) && o.isRun(saved) ? saved : null;
      }
      o.onStart(r, restored);
    },
    end(result) {
      ended = true;
      o.onEnd(result);
    },
    exit() {
      if (current) o.stash.remove(key(current));
      current = null;
      o.onExit();
    },
  });
  hub.race.on('closed', () => {
    if (current === null) return;
    current = null;
    o.onExit();
  });

  const once = (send: () => Promise<unknown>): void => {
    if (sent || current === null) return;
    sent = true;
    fireAndForget(send());
  };

  return {
    get live() {
      return current !== null && !ended;
    },
    get current() {
      return current;
    },
    locked: () => current === null || ended || sent || o.clock.now() < current.startAt,
    report(run, stats, progress) {
      if (current === null || ended || sent) return;
      const now = o.clock.now();
      if (now - lastStatus < RACE_STATUS_MS) return;
      lastStatus = now;
      hub.race.status(checkStats(stats), progress);
      o.stash.setJson(key(current), run);
    },
    finish: (stats) => once(() => hub.race.finish(checkStats(stats))),
    lose: (stats) => once(() => hub.race.lose(checkStats(stats))),
    leave() {
      if (current) o.stash.remove(key(current));
      current = null;
      fireAndForget(hub.race.leave());
    },
    create(params) {
      hub.race.create(params === undefined ? {} : { params }).catch((e: unknown) => o.notify(errText(e)));
    },
    browse: () => hub.race.browse(),
    history: () => hub.race.openHistory(),
  };
}

/** Where the race HUD ends at the top, in px (`--hub-race-hud-top`; solitaire raceBarBottom). */
export function raceBarTop(doc: Document = document): number {
  return Number.parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--hub-race-hud-top')) || 0;
}
