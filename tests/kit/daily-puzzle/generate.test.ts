import { describe, expect, it } from 'vitest';
import { generate, inRange, mulberry32, type PuzzleSpec, type Solved } from '../../../src/kit/daily-puzzle/index.ts';
import { buildCoinDaily, FALLBACK, solveCoins, type Coins, type Take } from './toy.ts';

/** A spec over a fixed list of candidates (null = skip). */
function listSpec(cands: (Coins | null)[], solve: (p: Coins) => Solved<Take> = (p) => solveCoins(p)): PuzzleSpec<Coins, Take> {
  return { scenario: (_r, attempt) => cands[attempt % cands.length], solve };
}
const fallback = () => ({ puzzle: FALLBACK, solved: solveCoins(FALLBACK) });

describe('generate', () => {
  it('is deterministic from the rng', () => {
    for (const seed of [1, 2, 3, 99]) expect(buildCoinDaily(seed)).toEqual({ ...buildCoinDaily(seed), elapsedMs: expect.any(Number) });
  });

  it('keeps a candidate only in the solution range and the band', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = buildCoinDaily(seed);
      if (g.fallback) continue;
      expect(inRange(g.lines.length, { min: 1, max: 2 })).toBe(true);
      expect(inRange(g.difficulty, { min: 2, max: 3 })).toBe(true);
    }
  });

  it('skips null candidates and inexact solves', () => {
    const one: Coins = { target: 5, coins: [2, 3] }; // 2+3 and 3+2: two lines
    const inexact = (p: Coins): Solved<Take> => ({ ...solveCoins(p), exact: false });
    const g = generate(mulberry32(1), listSpec([null, one]), { attempts: 5, solutions: { min: 1, max: 2 }, fallback });
    expect(g).toMatchObject({ fallback: false, attempts: 2, puzzle: one });
    expect(generate(mulberry32(1), listSpec([one], inexact), { attempts: 5, fallback }).fallback).toBe(true);
  });

  it('tries the preferred range first, then the wider one', () => {
    const two: Coins = { target: 5, coins: [2, 3] };
    const g = generate(mulberry32(1), listSpec([two]), {
      attempts: 10, solutions: { min: 1, max: 2 }, prefer: { solutions: { min: 1, max: 1 }, attempts: 4 }, fallback,
    });
    expect(g.attempts).toBe(5);
    expect(g.lines.length).toBe(2);
  });

  it('applies the game filter and falls back when nothing passes', () => {
    const g = generate(mulberry32(1), { ...listSpec([{ target: 5, coins: [2, 3] }]), accept: () => false }, { attempts: 7, fallback });
    expect(g).toMatchObject({ fallback: true, attempts: 7, puzzle: FALLBACK, lines: [[{ i: 0 }]] });
  });

  it('measures the time budget without changing the result', () => {
    let t = 0;
    const slow = (p: Coins): Solved<Take> => { t += 50; return solveCoins(p); };
    const opts = { attempts: 3, solutions: { min: 1, max: 1 }, timeBudgetMs: 120, fallback, now: () => t };
    const g = generate(mulberry32(1), listSpec([{ target: 5, coins: [2, 3] }], slow), opts);
    expect(g).toMatchObject({ fallback: true, elapsedMs: 150, overBudget: true });
    t = 0;
    expect(generate(mulberry32(1), listSpec([{ target: 5, coins: [5] }], slow), opts)).toMatchObject({ fallback: false, overBudget: false });
  });
});
