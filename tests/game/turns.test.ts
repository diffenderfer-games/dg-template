// The turn rules' conformance (GAME: yours to edit). Runs now; the hub runs the same rules once saved-games phase 3 ships.
import { describe, expect, it } from 'vitest';
import { rules } from '../../src/game/turns/rules.ts';
import { checkTurnRules } from '../../src/kit/turns/index.ts';
import { wordingProblems } from '../../src/kit/core/index.ts';
import { mulberry32 } from '../../src/kit/rng/index.ts';

describe('turn rules (take the last coin)', () => {
  it('passes checkTurnRules: deterministic, legal computer moves, never stuck, small JSON', () => {
    expect(checkTurnRules(rules, { seats: 2, options: null, games: 40 })).toEqual([]);
    expect(checkTurnRules(rules, { seats: 3, options: null, games: 20 })).toEqual([]);
  });

  it('refuses moves out of turn and bad takes with a short code', () => {
    const s = rules.setup({ seats: 2, options: null, mode: null, rng: mulberry32(1) });
    const rng = mulberry32(2);
    expect(rules.apply(s, 1, { take: 1 }, rng)).toEqual({ error: 'not_your_turn' });
    expect(rules.apply(s, 0, { take: 4 }, rng)).toEqual({ error: 'bad_take' });
  });

  it('progress labels are kid words', () => {
    const s = rules.setup({ seats: 2, options: null, mode: null, rng: mulberry32(1) });
    expect(wordingProblems(rules.progress(s, 0).label)).toEqual([]);
  });
});
