/**
 * The game's rules: pure functions, no DOM, no hub, no Math.random, no Date. (GAME: yours to edit.)
 *
 * Dailies and races build the same game for everyone from the seed, so ALL
 * randomness comes from the seeded RNG saved in the state (docs/kit/rng.md):
 * `const rng = SeededRng.restore(run.rng); … run.rng = rng.snapshot();`.
 */
import type { PlayMode } from '../kit/core/index.ts';
import { SeededRng } from '../kit/rng/index.ts';
import type { Run } from './state.ts';

/** What the player does this step. TODO(game): your inputs (read in hooks.ts from `ctx.hub.input`). */
export type StepInput = Record<string, never>;

/**
 * A fresh game. TODO(game): build the starting state from `seed` (through the RNG) only.
 * A race's params (`game.race.params`) come in `params`; a daily is `mode === 'daily'`.
 */
export function newRun(mode: PlayMode, seed: number, _params: Record<string, unknown> = {}): Run {
  const rng = new SeededRng(seed);
  return { mode, seed, rng: rng.snapshot(), t: 0, score: 0, over: null };
}

/**
 * Advance the game by `dt` seconds. TODO(game): move things, score, set `run.over`
 * ('won' / 'lost') when it ends. The kit finishes the game the frame `outcome()`
 * returns non-null: keep it null until an ending animation is done (docs/kit/hooks.md).
 */
export function step(run: Run, dt: number, _input: StepInput): void {
  if (run.over !== null) return;
  run.t += dt;
}

/** Is it over? */
export function outcome(run: Run): 'won' | 'lost' | null {
  return run.over;
}

/**
 * The "Your games" label: plain words for a kid, at most 60 characters, never "run".
 * TODO(game): e.g. "Level 12 · 34 cards left".
 */
export function progress(run: Run): { label: string; fraction?: number } {
  return { label: `${run.score} ${run.score === 1 ? 'point' : 'points'}` };
}

/** Add to the score (the kit's `__game.addScore` test driver). TODO(game): keep it adding to what `snap().score` shows. */
export function addScore(run: Run, n: number): void {
  run.score += n;
}

/** Win now (the test driver `__game.solveNow`). TODO(game): also make your state look won, if it shows. */
export function solve(run: Run): void {
  run.over = 'won';
}
