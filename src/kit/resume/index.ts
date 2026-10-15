/**
 * kit/resume: the hub.resume adapter (Continue), with the late-load guard.
 * Source: dg-template src/kit/resume/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/resume.md
 *
 * Players see "Continue" and "Your saved game", never "run". Rules:
 * - one cached, single-flight lookup (`load`), validated; a version mismatch reads null;
 * - `save` never in a race or online; in a daily it goes to the daily's own save
 *   once the hub has one (saved-games phase 1), and is a no-op before that;
 * - `beforeNewGame` waits (at most 8 s) for the lookup before a new game replaces it;
 * - a saved game found only after a new game started is offered, not lost (`offerLate`);
 * - an old `getSave` slot migrates once (`legacySlot`), then is deleted.
 */
import type { Activity } from '../core/activity.ts';
import { fireAndForget, singleFlight, withTimeout } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import { isJson, jsonEqual, type Json, type JsonObject } from '../core/json.ts';
import { kitWarn } from '../core/log.ts';
import { wordingProblems } from '../core/wording.ts';

/** What the game tells the kit about its saved game. */
export type ResumeSpec<R extends JsonObject> = {
  /** The saved game's shape version (a mismatch reads as nothing saved). */
  version: number;
  validate(x: Json): x is R;
  /** The "Your games" line: plain words for a kid, at most 60 characters. Never "run". */
  progress(r: R): { label: string; fraction?: number };
  /** Optional name for this saved game ("Hard mode"). */
  title?(r: R): string | null;
  /** An old `hub.getSave` slot that held the saved game before hub.resume. */
  legacySlot?: string;
  /** How long `beforeNewGame` waits for the lookup (default 8000 ms). */
  lateMs?: number;
};

/** The Continue slot. */
export type ResumeSlot<R extends JsonObject> = {
  /** Was the page opened from the Resume card (`?hub_resume=1`)? */
  readonly requested: boolean;
  /** Has the lookup finished (found, empty or failed)? */
  readonly known: boolean;
  load(): Promise<R | null>;
  /** Save the game in progress; false when blocked (race, online; a daily before the hub has daily saves). */
  save(r: R): boolean;
  /** The game ended (won, lost, quit, a new game): drop it. */
  clear(): void;
  flush(): void;
  /** Before a new game replaces the saved one: wait for the lookup; 'fresh' when nothing is saved. */
  beforeNewGame(): Promise<'fresh' | R>;
  /** When a saved game turns up after `current()` started, offer it (`onLate`), once. */
  offerLate(current: () => R | null, onLate: (saved: R) => void): void;
};

/** Create the Continue slot. */
export function createResume<R extends JsonObject>(
  hub: Pick<HubLike, 'resume' | 'daily' | 'getSave' | 'deleteSave'>,
  spec: ResumeSpec<R>,
  deps: { activity: Activity; clock: Clock },
): ResumeSlot<R> {
  let known = false;
  let cached: R | null = null;
  let lateWanted: { current: () => R | null; onLate: (saved: R) => void } | null = null;

  const lookup = singleFlight(async (): Promise<R | null> => {
    let found: R | null;
    try {
      const state = await hub.resume.load({ version: spec.version });
      found = isJson(state) && spec.validate(state) ? state : null;
      if (found === null && spec.legacySlot !== undefined) found = await migrateLegacy(spec.legacySlot);
    } catch {
      found = null;
    }
    cached = found;
    known = true;
    if (found !== null && lateWanted !== null) {
      const { current, onLate } = lateWanted;
      lateWanted = null;
      const now = current();
      if (now !== null && !jsonEqual(now, found)) onLate(found);
    }
    return found;
  });

  async function migrateLegacy(slot: string): Promise<R | null> {
    const { save } = await hub.getSave(slot);
    if (save === null) return null;
    const data = save.data;
    const run = spec.validate(data) ? data : null;
    if (run !== null) hub.resume.save(input(run));
    await hub.deleteSave(slot);
    return run;
  }

  function input(r: R): {
    state: R;
    progress: { label: string; fraction?: number };
    title: string | null;
    version: number;
  } {
    const progress = spec.progress(r);
    const problems = wordingProblems(progress.label);
    if (problems.length > 0) kitWarn(`resume progress label "${progress.label}": ${problems.join('; ')}`);
    return { state: r, progress, title: spec.title?.(r) ?? null, version: spec.version };
  }

  return {
    get requested() {
      return hub.resume.requested;
    },
    get known() {
      return known;
    },
    load: () => (known ? Promise.resolve(cached) : lookup()),
    save(r) {
      const mode = deps.activity.mode;
      if (mode === 'race' || mode === 'online') return false;
      if (mode === 'daily') {
        return hub.daily.save ? hub.daily.save(input(r)) : false;
      }
      cached = r;
      known = true;
      return hub.resume.save(input(r));
    },
    clear() {
      cached = null;
      fireAndForget(hub.resume.clear());
    },
    flush() {
      fireAndForget(hub.resume.flush());
    },
    async beforeNewGame() {
      const found = known ? cached : await withTimeout(deps.clock, lookup(), spec.lateMs ?? 8000, null);
      return found ?? 'fresh';
    },
    offerLate(current, onLate) {
      if (known) return;
      lateWanted = { current, onLate };
      void lookup();
    },
  };
}
