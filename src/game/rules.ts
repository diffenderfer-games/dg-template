/**
 * The game's rules: pure functions, no DOM, no hub, no Math.random, no Date. (GAME: yours to edit.)
 *
 * The example is "collect the coins": move the square onto the coin. Dailies
 * and races build the same game for everyone from the seed, so ALL randomness
 * comes from the seeded RNG saved in the state (docs/kit/rng.md).
 */
import type { PlayMode } from '../kit/core/index.ts';
import { SeededRng } from '../kit/rng/index.ts';
import { ARENA, RACE_DEFAULTS, TUNING } from './config.ts';
import type { Run, Vec } from './state.ts';

/** What the player does this step (from `hub.input.vector('move')`). */
export type StepInput = { x: number; y: number };

/** A fresh game. TODO(game): build the starting state of your game from `rng` only. */
export function newRun(mode: PlayMode, seed: number, opts: { coins?: number } = {}): Run {
  const rng = new SeededRng(seed);
  const target = mode === 'daily' ? rng.int(5, 10) : mode === 'race' ? (opts.coins ?? RACE_DEFAULTS.coins) : 0;
  const timeLimit = mode === 'normal' ? TUNING.normalSeconds : mode === 'daily' ? TUNING.dailySeconds : 0;
  const run: Run = {
    mode,
    seed,
    rng: rng.snapshot(),
    t: 0,
    timeLimit,
    target,
    player: { x: ARENA.width / 2, y: ARENA.height / 2 },
    coin: { x: 0, y: 0 },
    score: 0,
    over: null,
  };
  placeCoin(run);
  return run;
}

/** Put the coin somewhere new (from the saved RNG, so a restored game continues the same). */
function placeCoin(run: Run): void {
  const rng = SeededRng.restore(run.rng);
  const m = 60;
  do {
    run.coin = { x: m + rng.next() * (ARENA.width - 2 * m), y: m + rng.next() * (ARENA.height - 2 * m) };
  } while (dist(run.coin, run.player) < 250);
  run.rng = rng.snapshot();
}

const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Advance the game by `dt` seconds. Returns how many coins were collected (for
 * sounds and haptics). TODO(game): move things, detect wins and losses, set `run.over`.
 */
export function step(run: Run, dt: number, input: StepInput): number {
  if (run.over !== null) return 0;
  const len = Math.hypot(input.x, input.y);
  const k = len > 1 ? 1 / len : 1;
  const half = TUNING.playerHalf;
  run.player.x = clamp(run.player.x + input.x * k * TUNING.speed * dt, half, ARENA.width - half);
  run.player.y = clamp(run.player.y + input.y * k * TUNING.speed * dt, half, ARENA.height - half);
  run.t += dt;
  let got = 0;
  if (dist(run.player, run.coin) < TUNING.pickup) {
    run.score++;
    got = 1;
    placeCoin(run);
  }
  if (run.target > 0 && run.score >= run.target) run.over = 'won';
  else if (run.timeLimit > 0 && run.t >= run.timeLimit) run.over = run.target > 0 ? 'lost' : 'won';
  return got;
}

/** Is it over? */
export function outcome(run: Run): 'won' | 'lost' | null {
  return run.over;
}

/** Seconds left (or null without a limit). */
export function timeLeft(run: Run): number | null {
  return run.timeLimit > 0 ? Math.max(0, Math.ceil(run.timeLimit - run.t)) : null;
}

/**
 * The "Your games" label: plain words for a kid, at most 60 characters, never "run".
 * TODO(game): e.g. "Level 12 · 34 cards left".
 */
export function progress(run: Run): { label: string; fraction?: number } {
  const left = timeLeft(run);
  return left === null
    ? { label: `${run.score} coins` }
    : { label: `${run.score} coins · ${left} s left`, fraction: run.t / run.timeLimit };
}

/** Steer toward the coin (the test driver `__game.autoplay`, and the computer player online). */
export function steerToCoin(run: Run, from: Vec = run.player): StepInput {
  const dx = run.coin.x - from.x;
  const dy = run.coin.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Win now (the test driver `__game.solveNow`). */
export function solve(run: Run): void {
  run.score = Math.max(run.score, run.target);
  run.over = 'won';
}
