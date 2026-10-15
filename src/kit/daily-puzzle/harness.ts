/**
 * daily-puzzle kit: the test harness that checks N seeded days.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * Framework-free: `runDailyHarness` returns a report and `assertDailyHarness`
 * throws listing every problem, so it runs under vitest or node:test alike:
 *
 *   it('365 days', () => { assertDailyHarness({ game: 'garbage', from: '2026-01-01', days: 365, build, ... }); });
 *
 * For each day it checks: the generator is deterministic (two builds, equal
 * JSON), it fits the time budget, it didn't fall back (beyond `maxFallbacks`),
 * the line count is in range, every line replays to a win through the real
 * engine, the engine's own search finds the same number of lines, and no
 * first move outside the reported lines can still win.
 */
import { dayRange } from './days.ts';
import type { Generated, Range } from './generate.ts';
import { inRange } from './generate.ts';
import { hashJson, stableStringify, type Json } from './json.ts';
import { replayLine } from './replay.ts';
import { seedForDay } from './rng.ts';
import { findWinningLines, firstMoveOutcomes, type PuzzleRules, type SearchOptions } from './search.ts';

/** The real engine, to replay lines through (not the generator's own model). */
export type HarnessEngine<P extends Json, S, A extends Json> = {
  start(puzzle: P): S;
  rules: PuzzleRules<S, A>;
  /** Limits for the engine-side recount and the first-move check. */
  search?: SearchOptions<S, A>;
};

/** What to check. */
export type HarnessSpec<P extends Json, S, A extends Json> = {
  /** The hub slug: days are seeded with `seedForDay(game, day)`, as on the hub. */
  game: string;
  /** The first day checked. */
  from: string;
  /** How many consecutive days. */
  days: number;
  /** The game's daily generator (the version pinned for `day`). */
  build(seed: number, day: string): Generated<P, A>;
  /** The expected winning-line count (omit for a puzzle without lines). */
  solutions?: Range;
  /** The most a day may take to generate. */
  timeBudgetMs: number;
  /** Days allowed to use the hand-made fallback (default 0). */
  maxFallbacks?: number;
  /** Replay every line through this engine; also recount the lines and check the first moves. */
  engine?: HarnessEngine<P, S, A>;
  /** Check that no first move outside the reported lines wins (default true when `engine` is set). */
  checkFirstMoves?: boolean;
  /** The clock (default `performance.now`). */
  now?: () => number;
};

/** One day's result. */
export type DayReport = {
  day: string;
  seed: number;
  lines: number;
  difficulty: number;
  fallback: boolean;
  ms: number;
  /** The puzzle's hash (for generator-version snapshots). */
  hash: string;
  problems: string[];
};

/** The whole run. */
export type HarnessReport = {
  days: DayReport[];
  /** Every problem, as "day: what". */
  problems: string[];
  fallbacks: number;
  maxMs: number;
};

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function checkLines<P extends Json, S, A extends Json>(spec: HarnessSpec<P, S, A>, engine: HarnessEngine<P, S, A>, gen: Generated<P, A>, problems: string[]): void {
  const start = engine.start(gen.puzzle);
  gen.lines.forEach((line, i) => {
    const r = replayLine(engine.rules, start, line);
    if (!r.ok) problems.push(`line ${i + 1} does not replay to a win (${r.fault} at action ${r.at})`);
  });
  if (spec.solutions) {
    const recount = findWinningLines(engine.rules, start, { ...engine.search, limit: spec.solutions.max + 1 });
    if (recount.stopped === 'nodes') problems.push('the engine search hit its node cap');
    else if (recount.lines.length !== gen.lines.length) problems.push(`the engine finds ${recount.lines.length} winning lines, the generator reported ${gen.lines.length}`);
  }
  if (spec.checkFirstMoves ?? true) {
    // compared by step key, so a first move equivalent to a reported one (merged by the search) is fine
    const key = (a: A): string => (engine.search?.stepKey ? engine.search.stepKey(start, a) : stableStringify(a));
    const firsts = new Set(gen.lines.filter((l) => l.length > 0).map((l) => key(l[0])));
    for (const o of firstMoveOutcomes(engine.rules, start, engine.search)) {
      if (o.wins && !firsts.has(key(o.action))) problems.push(`first move ${stableStringify(o.action)} wins but starts no reported line`);
    }
  }
}

/** Check `spec.days` days from `spec.from`. */
export function runDailyHarness<P extends Json, S, A extends Json>(spec: HarnessSpec<P, S, A>): HarnessReport {
  const now = spec.now ?? clock;
  const days: DayReport[] = [];
  for (const day of dayRange(spec.from, spec.days)) {
    const seed = seedForDay(spec.game, day);
    const t0 = now();
    const gen = spec.build(seed, day);
    const ms = now() - t0;
    const again = spec.build(seed, day);
    const problems: string[] = [];
    if (stableStringify(gen.puzzle) !== stableStringify(again.puzzle) || stableStringify(gen.lines) !== stableStringify(again.lines)) {
      problems.push('not deterministic: the same seed built a different puzzle');
    }
    if (ms > spec.timeBudgetMs) problems.push(`took ${ms.toFixed(0)} ms (budget ${spec.timeBudgetMs} ms)`);
    if (spec.solutions && !inRange(gen.lines.length, spec.solutions)) {
      problems.push(`${gen.lines.length} winning lines (want ${spec.solutions.min}–${spec.solutions.max})`);
    }
    if (spec.engine) checkLines(spec, spec.engine, gen, problems);
    days.push({ day, seed, lines: gen.lines.length, difficulty: gen.difficulty, fallback: gen.fallback, ms, hash: hashJson(gen.puzzle), problems });
  }
  const fallbacks = days.filter((d) => d.fallback).length;
  const problems = days.flatMap((d) => d.problems.map((p) => `${d.day}: ${p}`));
  if (fallbacks > (spec.maxFallbacks ?? 0)) problems.push(`${fallbacks} days used the fallback puzzle (allowed ${spec.maxFallbacks ?? 0})`);
  return { days, problems, fallbacks, maxMs: Math.max(0, ...days.map((d) => d.ms)) };
}

/** Run the harness and throw an Error listing the problems (the first 25), if any. */
export function assertDailyHarness<P extends Json, S, A extends Json>(spec: HarnessSpec<P, S, A>): HarnessReport {
  const report = runDailyHarness(spec);
  if (report.problems.length) {
    const shown = report.problems.slice(0, 25).join('\n  ');
    const more = report.problems.length > 25 ? `\n  …and ${report.problems.length - 25} more` : '';
    throw new Error(`daily harness: ${report.problems.length} problem(s)\n  ${shown}${more}`);
  }
  return report;
}

/** The puzzle hash of each day (for a generator-version snapshot test). */
export function dailyHashes<P extends Json, A extends Json>(game: string, days: readonly string[], build: (seed: number, day: string) => Generated<P, A>): { [day: string]: string } {
  const out: { [day: string]: string } = {};
  for (const day of days) out[day] = hashJson(build(seedForDay(game, day), day).puzzle);
  return out;
}
