import { describe, expect, it } from 'vitest';
import {
  assertDailyHarness, dailyHashes, dayRange, runDailyHarness, seedForDay,
  type Generated, type HarnessSpec,
} from '../../../src/kit/daily-puzzle/index.ts';
import { buildCoinDaily, coinRules, coinSearch, startOf, type CoinState, type Coins, type Take } from './toy.ts';

const engine = { start: startOf, rules: coinRules, search: coinSearch };
const spec = (over: Partial<HarnessSpec<Coins, CoinState, Take>> = {}): HarnessSpec<Coins, CoinState, Take> => ({
  game: 'toy', from: '2026-01-01', days: 30, build: (seed) => buildCoinDaily(seed),
  solutions: { min: 1, max: 2 }, timeBudgetMs: 1000, maxFallbacks: 0, engine, ...over,
});

describe('daily harness', () => {
  it('passes a sound generator over 365 days', () => {
    const report = assertDailyHarness(spec({ days: 365 }));
    expect(report.days).toHaveLength(365);
    expect(report.days[0]).toMatchObject({ day: '2026-01-01', seed: seedForDay('toy', '2026-01-01') });
    expect(report.fallbacks).toBe(0);
  });

  it('catches a generator that is not deterministic', () => {
    let n = 0;
    const r = runDailyHarness(spec({ days: 2, build: (seed) => buildCoinDaily(seed + n++) }));
    expect(r.problems.filter((p) => p.includes('not deterministic'))).toHaveLength(2);
  });

  it('catches the line count, a line that does not win, and a missing winning first move', () => {
    const lying = (seed: number): Generated<Coins, Take> => {
      const g = buildCoinDaily(seed);
      return { ...g, lines: [g.lines[0].slice(0, -1)] };
    };
    const r = runDailyHarness(spec({ days: 3, build: lying, solutions: { min: 1, max: 1 } }));
    expect(r.problems.some((p) => p.includes('does not replay to a win'))).toBe(true);
    const counts = runDailyHarness(spec({ days: 20, solutions: { min: 1, max: 1 } }));
    expect(counts.problems.some((p) => /2 winning lines \(want 1–1\)/.test(p))).toBe(true);
    expect(counts.problems.some((p) => p.includes('the engine finds'))).toBe(false);
  });

  it('flags a winning first move that starts no reported line', () => {
    const r = runDailyHarness(spec({
      days: 1, solutions: undefined,
      build: () => ({ puzzle: { target: 7, coins: [4, 3] }, lines: [[{ i: 0 }, { i: 0 }]], difficulty: 2, attempts: 1, fallback: false, elapsedMs: 0, overBudget: false }),
    }));
    expect(r.problems).toEqual(['2026-01-01: first move {"i":1} wins but starts no reported line']);
  });

  it('checks the time budget and the fallbacks', () => {
    let t = 0;
    const r = runDailyHarness(spec({ days: 2, timeBudgetMs: 10, now: () => (t += 20) }));
    expect(r.problems.filter((p) => p.includes('budget'))).toHaveLength(2);
    const fb = runDailyHarness(spec({ days: 2, build: (seed) => ({ ...buildCoinDaily(seed), fallback: true }) }));
    expect(fb.fallbacks).toBe(2);
    expect(fb.problems).toContain('2 days used the fallback puzzle (allowed 0)');
    expect(() => assertDailyHarness(spec({ days: 2, maxFallbacks: 0, build: (seed) => ({ ...buildCoinDaily(seed), fallback: true }) }))).toThrow(/1 problem\(s\)\n {2}2 days used the fallback/);
  });

  it('runs without an engine (a puzzle without lines)', () => {
    const r = runDailyHarness<Coins, CoinState, Take>({ game: 'toy', from: '2026-01-01', days: 5, build: (s) => buildCoinDaily(s), timeBudgetMs: 1000 });
    expect(r.problems).toEqual([]);
  });

  it('dailyHashes snapshots the puzzles of fixed days', () => {
    const days = dayRange('2026-01-01', 3);
    const a = dailyHashes('toy', days, (s) => buildCoinDaily(s));
    expect(Object.keys(a)).toEqual(days);
    expect(dailyHashes('toy', days, (s) => buildCoinDaily(s))).toEqual(a);
    expect(new Set(Object.values(a)).size).toBe(3);
  });
});
