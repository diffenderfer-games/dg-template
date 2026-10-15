/**
 * daily-puzzle kit: the generate → solve → filter loop.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * Each attempt builds a candidate from the day's RNG, solves it and keeps it
 * only when its winning-line count is in range and its difficulty is in the
 * day's band. The attempt cap is what bounds the work: the time budget is only
 * measured and reported (`overBudget`), never used to stop early, because a
 * clock-dependent cut-off would give different puzzles on slow and fast devices.
 */
import type { Json } from './json.ts';
import type { Rng } from './rng.ts';

/** An inclusive range. */
export type Range = { min: number; max: number };

/** Is `n` within `r`? */
export function inRange(n: number, r: Range): boolean {
  return n >= r.min && n <= r.max;
}

/** A solved candidate. */
export type Solved<A extends Json> = {
  /** Its distinct winning lines (a search with `limit: solutions.max + 1` is enough). */
  lines: A[][];
  /** The game's difficulty score. */
  difficulty: number;
  /** False when the search hit its node cap, so the count can't be trusted (the candidate is skipped). */
  exact: boolean;
};

/** A game's puzzle generator, as the loop sees it. */
export type PuzzleSpec<P extends Json, A extends Json> = {
  /** Build one candidate from the RNG, or `null` to skip this attempt. */
  scenario(rng: Rng, attempt: number): P | null;
  /** Solve a candidate. */
  solve(puzzle: P): Solved<A>;
  /** Extra rules a candidate must meet (decision points, decoys…). */
  accept?(puzzle: P, solved: Solved<A>): boolean;
};

/** The loop's limits and filters. */
export type GenerateOptions<P extends Json, A extends Json> = {
  /** The most attempts before the fallback. */
  attempts: number;
  /** The winning-line count to keep (omit for a puzzle without lines, like a seeded rally). */
  solutions?: Range;
  /** A tighter range tried for the first `attempts` attempts (Pop Four: exactly 1 for the first 1500). */
  prefer?: { solutions: Range; attempts: number };
  /** The day's difficulty band (omit to keep any difficulty). */
  band?: Range;
  /** Measured only: `overBudget` is set when generation took longer. */
  timeBudgetMs?: number;
  /** The clock for the measurement (default `performance.now`). */
  now?: () => number;
  /** A hand-made puzzle (with its solution), used when no attempt passes. */
  fallback(): { puzzle: P; solved: Solved<A> };
};

/** The day's puzzle. */
export type Generated<P extends Json, A extends Json> = {
  puzzle: P;
  /** Its distinct winning lines. */
  lines: A[][];
  difficulty: number;
  /** Attempts used (the fallback counts all of them). */
  attempts: number;
  /** True when no attempt passed and the hand-made puzzle was used. */
  fallback: boolean;
  /** Wall-clock time taken (informational). */
  elapsedMs: number;
  /** True when `elapsedMs` passed `timeBudgetMs`. */
  overBudget: boolean;
};

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Does a solved candidate pass the count, band and game filters? */
function passes<P extends Json, A extends Json>(spec: PuzzleSpec<P, A>, opts: GenerateOptions<P, A>, puzzle: P, solved: Solved<A>, attempt: number): boolean {
  if (!solved.exact) return false;
  const range = opts.prefer && attempt < opts.prefer.attempts ? opts.prefer.solutions : opts.solutions;
  if (range && !inRange(solved.lines.length, range)) return false;
  if (opts.band && !inRange(solved.difficulty, opts.band)) return false;
  return spec.accept ? spec.accept(puzzle, solved) : true;
}

/** Generate the day's puzzle. Same RNG state in, same puzzle out. */
export function generate<P extends Json, A extends Json>(rng: Rng, spec: PuzzleSpec<P, A>, opts: GenerateOptions<P, A>): Generated<P, A> {
  const now = opts.now ?? clock;
  const t0 = now();
  const done = (puzzle: P, solved: Solved<A>, attempts: number, fallback: boolean): Generated<P, A> => {
    const elapsedMs = now() - t0;
    return {
      puzzle, lines: solved.lines, difficulty: solved.difficulty, attempts, fallback, elapsedMs,
      overBudget: opts.timeBudgetMs !== undefined && elapsedMs > opts.timeBudgetMs,
    };
  };
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    const puzzle = spec.scenario(rng, attempt);
    if (puzzle === null) continue;
    const solved = spec.solve(puzzle);
    if (passes(spec, opts, puzzle, solved, attempt)) return done(puzzle, solved, attempt + 1, false);
  }
  const fb = opts.fallback();
  return done(fb.puzzle, fb.solved, opts.attempts, true);
}
