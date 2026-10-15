// Planned hub API adapter (kit/turns), tested against the plan's shapes (FakeHub planned flags).
import { describe, expect, it } from 'vitest';
import type { Json } from '../../../src/kit/core/index.ts';
import { createFakeHub } from '../../../src/kit/testing/index.ts';
import { checkTurnRules, createTurns, nudger, type TurnRules } from '../../../src/kit/turns/index.ts';

describe('kit/turns', () => {
  type S = { secret: string[]; turn: number; left: number };
  const leaky: TurnRules<S, { n: number }, Json> = {
    version: 1,
    setup: () => ({ secret: ['card-A', 'card-B'], turn: 0, left: 5 }),
    view: (s) => ({ all: s.secret }), // shows every seat's card: a leak
    toAct: (s) => (s.left > 0 ? [s.turn] : []),
    apply: (s, seat, m) => ({ state: { ...s, left: s.left - m.n, turn: 1 - seat } }),
    outcome: (s) => (s.left <= 0 ? { winners: [0] } : null),
    progress: () => ({ label: 'x' }),
    autoMove: () => ({ n: 1 }),
  };

  it('checkTurnRules finds a view that leaks another seat’s secret', () => {
    const problems = checkTurnRules(leaky, {
      seats: 2,
      options: null,
      games: 1,
      secretsOf: (s, seat) => [s.secret[seat] ?? ''],
    });
    expect(problems.some((p) => p.problem.includes('secret'))).toBe(true);
  });

  it('checkTurnRules needs autoMove, and reports an illegal computer move', () => {
    const noAuto: TurnRules<S, { n: number }, Json> = { ...leaky, autoMove: undefined };
    expect(checkTurnRules(noAuto, { seats: 2, options: null })[0]?.problem).toMatch(/autoMove/);
    const illegal: TurnRules<S, { n: number }, Json> = { ...leaky, view: () => ({}), apply: () => ({ error: 'nope' }) };
    expect(checkTurnRules(illegal, { seats: 2, options: null, games: 1 })[0]?.problem).toMatch(/illegal/);
  });

  it('the adapter is off until the hub has hub.turns; nudge is once a day in the UI', async () => {
    expect(createTurns(createFakeHub({ events: new EventTarget() })).available).toBe(false);
    const fake = createFakeHub({ events: new EventTarget(), planned: { turns: true } });
    const game = await createTurns(fake).open('g1');
    let t = 0;
    const nudge = game ? nudger(game, () => t) : () => false;
    expect(nudge()).toBe(true);
    expect(nudge()).toBe(false);
    t = 25 * 3600 * 1000;
    expect(nudge()).toBe(true);
  });
});
