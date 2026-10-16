// The game's balance, checked by the sim. TODO(game): your tuning targets, e.g.
//   expect(simulate(simSpec('daily', 0.8), seedRange(100)).outcomes.won).toBeGreaterThanOrEqual(90);
import { describe, expect, it } from 'vitest';
import { simSpec } from '../../src/game/sim.ts';
import { seedRange, simulate } from '../../src/kit/testing/sim.ts';

describe('balance', () => {
  it('the sim plays the rules', () => {
    const r = simulate(simSpec('normal'), seedRange(5));
    expect(r.games).toBe(5);
  });
});
