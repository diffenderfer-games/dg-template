/**
 * daily-puzzle kit: attempts, stars and the play-time run with its instant fail.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * Stars follow Pop Four: solved on the first try 3, the second 2, later 1. A
 * failed try counts until the day is solved; replaying a solved day changes
 * nothing. The records are plain JSON for the game's own save.
 */
import type { Json } from './json.ts';
import { hasWinningLine, type PuzzleRules, type SearchOptions } from './search.ts';

/** 1, 2 or 3 stars. */
export type Stars = 1 | 2 | 3;

/** Stars for a solve on try number `attempts` (1 = first try). */
export function starsFor(attempts: number): Stars {
  return attempts <= 1 ? 3 : attempts === 2 ? 2 : 1;
}

/** One day's record in the game's save. */
export type DayRecord = { attempts: number; stars?: Stars };

/** Every day's record, by `YYYY-MM-DD`. */
export type DailyBook = { [day: string]: DayRecord };

/** The record after a failed try (counted only while the day is unsolved). */
export function recordFail(rec: DayRecord | undefined): DayRecord {
  const r = rec ?? { attempts: 0 };
  return r.stars ? { ...r } : { ...r, attempts: r.attempts + 1 };
}

/** The record after a win, its stars, and whether this was the first solve. */
export function recordWin(rec: DayRecord | undefined): { record: DayRecord; stars: Stars; firstSolve: boolean } {
  const r = rec ?? { attempts: 0 };
  if (r.stars) return { record: { ...r }, stars: r.stars, firstSolve: false };
  const attempts = r.attempts + 1;
  const stars = starsFor(attempts);
  return { record: { attempts, stars }, stars, firstSolve: true };
}

/** The better of two records for a day (merging two copies of a save). */
export function betterRecord(a: DayRecord | undefined, b: DayRecord | undefined): DayRecord | undefined {
  if (!a || !b) return a ?? b;
  if ((a.stars ?? 0) !== (b.stars ?? 0)) return (a.stars ?? 0) > (b.stars ?? 0) ? a : b;
  return a.attempts >= b.attempts ? a : b;
}

/** Merge two books day by day, keeping the better record. */
export function mergeBooks(a: DailyBook, b: DailyBook): DailyBook {
  const out: DailyBook = {};
  for (const day of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const r = betterRecord(a[day], b[day]);
    if (r) out[day] = r;
  }
  return out;
}

/** Drop the days before `keepFrom` (`YYYY-MM-DD`), so the save stays small. */
export function pruneBook(book: DailyBook, keepFrom: string): DailyBook {
  const out: DailyBook = {};
  for (const [day, r] of Object.entries(book)) if (day >= keepFrom) out[day] = r;
  return out;
}

/** Where a run stands. */
export type RunStatus = 'playing' | 'won' | 'failed';

/** Options of a play-time run. */
export type RunOptions<S, A extends Json> = {
  /** Is the puzzle still winnable from `state`? Default: a winning-line search. */
  winnable?: (state: S) => boolean;
  /** Limits for the default check. */
  search?: SearchOptions<S, A>;
};

/**
 * One try at the puzzle: every action goes through the game's rules, and the
 * try fails at once when no winning line is left (the instant fail). `line`
 * is what to send as `meta.line` on a win.
 */
export class PuzzleRun<S, A extends Json> {
  readonly rules: PuzzleRules<S, A>;
  readonly start: S;
  state: S;
  line: A[] = [];
  status: RunStatus = 'playing';
  private readonly winnable: (state: S) => boolean;

  constructor(rules: PuzzleRules<S, A>, start: S, opts: RunOptions<S, A> = {}) {
    this.rules = rules;
    this.start = start;
    this.state = start;
    this.winnable = opts.winnable ?? ((s: S) => hasWinningLine(rules, s, opts.search));
  }

  /** Play `action`. Returns the new status, or `null` when it is illegal (nothing changes) or the run is over. */
  play(action: A): RunStatus | null {
    if (this.status !== 'playing') return null;
    const next = this.rules.apply(this.state, action);
    if (next === null) return null;
    this.state = next;
    this.line.push(action);
    if (this.rules.won(next)) this.status = 'won';
    else if (!this.winnable(next)) this.status = 'failed';
    return this.status;
  }

  /** Start the try again from the puzzle's first position. */
  restart(): void {
    this.state = this.start;
    this.line = [];
    this.status = 'playing';
  }
}
