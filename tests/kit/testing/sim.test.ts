import { describe, expect, it } from 'vitest';
import { formatReport, seedRange, simulate, type SimSpec } from '../../../src/kit/testing/sim.ts';

type S = { n: number; goal: number };
const spec: SimSpec<S, number> = {
  start: (seed) => ({ n: 0, goal: seed }),
  policy: () => 1,
  step: (s, _dt, i) => void (s.n += i),
  outcome: (s) => (s.n >= s.goal ? 'won' : null),
  measure: (s, steps) => ({ steps, n: s.n }),
  maxSteps: 5,
};

describe('simulate', () => {
  it('plays each seed, counts outcomes and timeouts, summarizes measures', () => {
    const r = simulate(spec, [1, 3, 9]);
    expect(r.games).toBe(3);
    expect(r.outcomes).toEqual({ won: 2, timeout: 1 });
    expect(r.stats.steps).toEqual({ min: 1, max: 5, mean: 3, median: 3 });
  });

  it('medians of an even count average the middle two', () => {
    expect(simulate(spec, [1, 3]).stats.n?.median).toBe(2);
  });

  it('seedRange and formatReport', () => {
    expect(seedRange(3, 5)).toEqual([5, 6, 7]);
    expect(formatReport(simulate(spec, [2]))).toMatch(/^1 games: won 1\n {2}steps/);
  });
});
