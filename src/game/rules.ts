/**
 * The game's rules: pure functions, no DOM, no hub, no Math.random, no Date. (GAME: yours to edit.)
 *
 * The starter is a placeholder: each press of the action button scores a
 * point. Replace it with your game. Dailies and races build the same game
 * for everyone from the seed, so ALL randomness comes from the seeded RNG
 * saved in the state (docs/kit/rng.md).
 */
import type { PlayMode } from '../kit/core/index.ts';
import { SeededRng } from '../kit/rng/index.ts';
import { RACE_DEFAULTS, TUNING } from './config.ts';
import type { Run } from './state.ts';

/** What the player does this step. TODO(game): your inputs. */
export type StepInput = { press: boolean };

/** A fresh game. TODO(game): build the starting state of your game from `seed` (through the RNG) only. */
export function newRun(mode: PlayMode, seed: number, opts: { target?: number } = {}): Run {
  const rng = new SeededRng(seed);
  const target = mode === 'daily' ? rng.int(15, 25) : mode === 'race' ? (opts.target ?? RACE_DEFAULTS.target) : 0;
  return { mode, seed, rng: rng.snapshot(), t: 0, score: 0, target, over: null };
}

/** Seconds allowed (0: no limit, e.g. a race). */
export function timeLimit(run: Run): number {
  return run.mode === 'normal' ? TUNING.normalSeconds : run.mode === 'daily' ? TUNING.dailySeconds : 0;
}

/**
 * Advance the game by `dt` seconds. Returns the points scored this step (for
 * sounds and haptics). TODO(game): move things, detect wins and losses, set `run.over`.
 * The kit finishes the game the frame `outcome()` returns non-null: keep it
 * null until an ending animation is done (count it here, docs/kit/hooks.md).
 */
export function step(run: Run, dt: number, input: StepInput): number {
  if (run.over !== null) return 0;
  run.t += dt;
  const got = input.press ? 1 : 0;
  run.score += got;
  const limit = timeLimit(run);
  if (run.target > 0 && run.score >= run.target) run.over = 'won';
  else if (limit > 0 && run.t >= limit) run.over = run.target > 0 ? 'lost' : 'won';
  return got;
}

/** Is it over? */
export function outcome(run: Run): 'won' | 'lost' | null {
  return run.over;
}

/** Seconds left (or null without a limit). */
export function timeLeft(run: Run): number | null {
  const limit = timeLimit(run);
  return limit > 0 ? Math.max(0, Math.ceil(limit - run.t)) : null;
}

/**
 * The "Your games" label: plain words for a kid, at most 60 characters, never "run".
 * TODO(game): e.g. "Level 12 · 34 cards left".
 */
export function progress(run: Run): { label: string; fraction?: number } {
  const left = timeLeft(run);
  const points = `${run.score} ${run.score === 1 ? 'point' : 'points'}`;
  return left === null ? { label: points } : { label: `${points} · ${left} s left`, fraction: run.t / timeLimit(run) };
}

/** Add points (the kit's `__game.addScore` test driver). */
export function addScore(run: Run, n: number): void {
  run.score += n;
}

/** Win now (the test driver `__game.solveNow`). */
export function solve(run: Run): void {
  run.score = Math.max(run.score, run.target);
  run.over = 'won';
}

/** A player who presses on every other step (the test driver `__game.autoplay`, the sim, computer players). */
export function autoInput(run: Run): StepInput {
  return { press: Math.round(run.t * 60) % 2 === 0 };
}
