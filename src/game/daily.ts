/**
 * The daily challenge. (GAME: yours to edit; delete it with `new-game` when the game has no daily.)
 *
 * The kit builds the day with `newRun({ mode: 'daily', seed })`, so the same
 * day is the same game for everyone. Your daily state must be JSON and
 * resumable: a day the player left is a day in progress (it shows on the title
 * and in the hub's Your games), and comes back through `run.validate` →
 * straight into play, where they left it.
 * A puzzle daily uses the daily-puzzle kit (docs/kit/daily-puzzle.md): put its
 * `buildDaily` behind newRun, and `winMeta` here.
 */
import type { DailyHooks } from '../kit/boot/index.ts';
import type { Run } from './state.ts';

/** TODO(game): extra fields for hub.daily.complete (stars, attempts…). `score` is filled from the result. */
export const daily: DailyHooks<Run> = {
  meta: (run) => ({ coins: run.score, seconds: Math.round(run.t) }),
  offline: 'play-unrecorded',
};
