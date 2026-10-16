// The online rules' conformance (GAME: yours to edit), with the hub's own checkTurnRules.
import { describe, expect, it } from 'vitest';
import { rules } from '../../src/game/turns/rules.ts';
import { checkTurnRules, createTurnRng, turnRngStateFromSeed } from '../../src/kit/turns/index.ts';
import { wordingProblems } from '../../src/kit/core/index.ts';

const rng = (seed: number): ReturnType<typeof createTurnRng> => createTurnRng(turnRngStateFromSeed(seed));

describe('turn rules (take the last one)', () => {
  it('passes checkTurnRules: deterministic, legal computer moves, never stuck, small JSON', () => {
    const report = checkTurnRules(rules, { seats: [2, 3], games: 30 });
    expect(report.games).toBe(60);
  });

  it('refuses moves out of turn and bad takes with a short code', () => {
    const s = rules.setup({ seats: 2, options: null, mode: null, rng: rng(1) });
    expect(rules.apply(s, 1, { take: 1 }, rng(2))).toEqual({ error: 'not_your_turn' });
    expect(rules.apply(s, 0, { take: 4 }, rng(2))).toEqual({ error: 'bad_take' });
  });

  it('progress labels are kid words', () => {
    const s = rules.setup({ seats: 2, options: null, mode: null, rng: rng(1) });
    expect(wordingProblems(rules.progress(s, 0).label)).toEqual([]);
  });
});
