// The online rules' conformance (GAME: yours to edit), with the hub's own checkTurnRules.
// TODO(game): add your rules' own cases (illegal moves, the end, hidden information: plant/shuffleHidden).
import { describe, expect, it } from 'vitest';
import { rules } from '../../src/game/turns/rules.ts';
import { checkTurnRules, createTurnRng, turnRngStateFromSeed } from '../../src/kit/turns/index.ts';
import { wordingProblems } from '../../src/kit/core/index.ts';

const rng = (seed: number): ReturnType<typeof createTurnRng> => createTurnRng(turnRngStateFromSeed(seed));

describe('turn rules', () => {
  it('passes checkTurnRules: deterministic, legal computer moves, never stuck, small JSON', () => {
    const report = checkTurnRules(rules, { seats: [2, 3], games: 30 });
    expect(report.games).toBe(60);
  });

  it('refuses a move out of turn with a short code', () => {
    const s = rules.setup({ seats: 2, options: null, mode: null, rng: rng(1) });
    expect(rules.apply(s, 1, { pass: true }, rng(2))).toEqual({ error: 'not_your_turn' });
  });

  it('progress labels are kid words', () => {
    const s = rules.setup({ seats: 2, options: null, mode: null, rng: rng(1) });
    expect(wordingProblems(rules.progress(s, 0).label)).toEqual([]);
  });
});
