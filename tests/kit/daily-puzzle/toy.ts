/**
 * A toy puzzle for the kit's tests: "make exactly `target` from these coins".
 * Each action takes one remaining coin; taking two equal coins in either order
 * is one line (the step key is the coin's value).
 */
import {
  findWinningLines, generate, mulberry32, randInt,
  type Generated, type PuzzleRules, type SearchOptions, type Solved,
} from '../../../src/kit/daily-puzzle/index.ts';

export type Coins = { target: number; coins: number[] };
export type CoinState = { total: number; target: number; left: number[] };
export type Take = { i: number };

export const coinRules: PuzzleRules<CoinState, Take> = {
  moves: (s) => (s.total >= s.target ? [] : s.left.map((_, i) => ({ i }))),
  apply: (s, a) => {
    if (!Number.isInteger(a.i) || a.i < 0 || a.i >= s.left.length) return null;
    return { total: s.total + s.left[a.i], target: s.target, left: s.left.filter((_, j) => j !== a.i) };
  },
  won: (s) => s.total === s.target,
};

export const coinSearch: SearchOptions<CoinState, Take> = { stepKey: (s, a) => String(s.left[a.i]) };

export const startOf = (p: Coins): CoinState => ({ total: 0, target: p.target, left: p.coins.slice() });

export function solveCoins(p: Coins, max = 2): Solved<Take> {
  const r = findWinningLines(coinRules, startOf(p), { ...coinSearch, limit: max + 1 });
  const longest = Math.max(0, ...r.lines.map((l) => l.length));
  return { lines: r.lines, difficulty: longest, exact: r.stopped !== 'nodes' };
}

export const FALLBACK: Coins = { target: 5, coins: [5, 1, 1] };

/** The toy's daily: 1–2 lines, difficulty (the longest line) in 2–3. */
export function buildCoinDaily(seed: number): Generated<Coins, Take> {
  const rng = mulberry32(seed);
  return generate(rng, {
    scenario: (r) => ({ target: randInt(r, 6, 14), coins: Array.from({ length: 5 }, () => randInt(r, 1, 7)) }),
    solve: (p) => solveCoins(p),
  }, {
    attempts: 400,
    solutions: { min: 1, max: 2 },
    band: { min: 2, max: 3 },
    fallback: () => ({ puzzle: FALLBACK, solved: solveCoins(FALLBACK) }),
  });
}
