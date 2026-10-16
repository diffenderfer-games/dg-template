/**
 * The game's saved shapes: the profile (long-term) and the game in progress. (GAME: yours to edit.)
 *
 * Both are plain JSON, declared with `type` (not `interface`), so the kit can
 * save, compare and validate them. See docs/kit/save.md and docs/kit/resume.md.
 */
import type { Json, PlayMode } from '../kit/core/index.ts';
import { maxOf } from '../kit/save/index.ts';

/** The game in progress (saved for Continue, rebuilt exactly from it). TODO(game): your game's state. */
export type Run = {
  mode: PlayMode;
  seed: number;
  /** The seeded RNG's state (SeededRng.snapshot), so a restored game continues the same. */
  rng: number;
  /** Seconds played. */
  t: number;
  score: number;
  /** Points to win (0: score as many as you can before time is up). */
  target: number;
  over: 'won' | 'lost' | null;
};

/** Long-term progress, synced to the hub. TODO(game): your unlocks and bests. */
export type Profile = { best: number; played: number };

/** A fresh profile. */
export function defaultProfile(): Profile {
  return { best: 0, played: 0 };
}

/** Cloud and local copies combined: only grows (docs/kit/save.md § "Merging"). TODO(game): one rule per field. */
export function mergeProfile(cloud: Profile, local: Profile): Profile {
  return { best: maxOf(cloud.best, local.best), played: maxOf(cloud.played, local.played) };
}

const isObject = (x: Json): x is { [k: string]: Json } => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Is this a valid profile? (Invalid cloud data is ignored, never adopted.) */
export function isProfile(x: Json): x is Profile {
  return isObject(x) && typeof x.best === 'number' && typeof x.played === 'number';
}

/** Is this a valid saved game? TODO(game): check every field you rely on. */
export function isRun(x: Json): x is Run {
  return (
    isObject(x) &&
    typeof x.seed === 'number' &&
    typeof x.rng === 'number' &&
    typeof x.t === 'number' &&
    typeof x.score === 'number' &&
    typeof x.target === 'number' &&
    (x.mode === 'normal' || x.mode === 'daily' || x.mode === 'race' || x.mode === 'online') &&
    (x.over === null || x.over === 'won' || x.over === 'lost')
  );
}

/** What everyone sees in an online match (src/game/online.ts; no secrets here, hide them there in yours). */
export type OnlineView = {
  players: { id: number; score: number }[];
  target: number;
  winner: number | null;
};
