/**
 * Races: two or more players get the same game from the same seed; first to finish wins.
 * (GAME: yours to edit; delete it with `new-game` when the game has no race.)
 *
 * Declare `game.race` in package.json (params, stats, minMs). The kit builds
 * the race game with `newRun({ mode: 'race', seed, params })`, reports these
 * stats (throttled) and finishes or loses for you. Stats are numbers,
 * booleans or `#rrggbb`, never text (multiplayer.md §14). Players never see
 * a param's key, only its `title`.
 */
import type { RaceHooks } from '../kit/boot/index.ts';
import type { Run } from './state.ts';

/** TODO(game): your race stats (the keys of `game.race.stats`) and how far along a player is (0..1). */
export const race: RaceHooks<Run> = {
  stats: (run) => ({ score: run.score }),
  progress: () => 0,
  // TODO(game): `params: () => ({ … })` for the Race button (default: the `game.race.params` defaults).
};
