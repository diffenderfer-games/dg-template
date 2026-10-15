// The game's balance, checked by the sim (TODO(game): your tuning targets).
import { describe, expect, it } from 'vitest';
import { simSpec } from '../../src/game/sim.ts';
import { seedRange, simulate } from '../../src/kit/testing/sim.ts';

describe('balance', () => {
  it('a decent player wins the daily, in under a minute on the median', () => {
    const r = simulate(simSpec('daily', 0.8), seedRange(100));
    expect(r.outcomes.won).toBeGreaterThanOrEqual(90);
    expect(r.stats.seconds?.median).toBeLessThan(60);
  });

  it('a normal game always ends (the timer)', () => {
    const r = simulate(simSpec('normal', 0.5), seedRange(30));
    expect(r.outcomes.timeout).toBeUndefined();
  });
});
