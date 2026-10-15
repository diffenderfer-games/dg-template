/**
 * daily-puzzle kit: replay and verify a reported winning line.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * A win sends its action list as `meta.line`. Because the generator is pure,
 * anyone with the day can rebuild the puzzle (`seedForDay` + the pinned
 * generator version) and replay the line through the real engine.
 */
import type { Json } from './json.ts';
import type { PuzzleRules } from './search.ts';

/** Why a line is not a win. */
export type ReplayFault = 'illegal' | 'not-won' | 'won-early';

/** The result of a replay: `fault` is null on a win; `at` is the faulty action's index. */
export type ReplayResult<S> = { ok: boolean; fault: ReplayFault | null; at: number; state: S };

/**
 * Replay `line` from `start`. It is a win when every action is legal and the
 * goal is met after the last one, not before it (`at` is the action's index).
 */
export function replayLine<S, A extends Json>(rules: PuzzleRules<S, A>, start: S, line: readonly A[]): ReplayResult<S> {
  let state = start;
  for (let i = 0; i < line.length; i++) {
    if (rules.won(state)) return { ok: false, fault: 'won-early', at: i, state };
    const next = rules.apply(state, line[i]);
    if (next === null) return { ok: false, fault: 'illegal', at: i, state };
    state = next;
  }
  const ok = rules.won(state);
  return { ok, fault: ok ? null : 'not-won', at: line.length, state };
}

/** Everything needed to rebuild a day's puzzle and check a line against it. */
export type DailyVerifier<P, S, A extends Json> = {
  /** The day's puzzle from its seed (with the generator version pinned for that day). */
  build(seed: number, day: string): P;
  /** The engine's start state for a puzzle. */
  start(puzzle: P): S;
  rules: PuzzleRules<S, A>;
};

/** Rebuild the puzzle of (`seed`, `day`) and replay `line` on it. */
export function verifyDailyLine<P, S, A extends Json>(v: DailyVerifier<P, S, A>, seed: number, day: string, line: readonly A[]): ReplayResult<S> {
  return replayLine(v.rules, v.start(v.build(seed, day)), line);
}
