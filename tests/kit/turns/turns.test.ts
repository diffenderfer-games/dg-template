// kit/turns: the hub's rules kit (re-exported) and the hub.turns adapter, on the FakeHub.
import { describe, expect, it } from 'vitest';
import type { Json } from '../../../src/kit/core/index.ts';
import { createFakeHub } from '../../../src/kit/testing/index.ts';
import { checkTurnRules, createTurns, nudger, type TurnRules } from '../../../src/kit/turns/index.ts';

describe('kit/turns', () => {
  type S = { hands: string[]; turn: number; left: number };
  const leaky: TurnRules<S, { n: number }, Json> = {
    version: 1,
    setup: () => ({ hands: ['', ''], turn: 0, left: 5 }),
    view: (s) => ({ all: s.hands }), // shows every seat's hand: a leak
    toAct: (s) => (s.left > 0 ? [s.turn] : []),
    apply: (s, seat, m) => ({ state: { ...s, left: s.left - m.n, turn: 1 - seat } }),
    outcome: (s) => (s.left <= 0 ? { winners: [0] } : null),
    progress: () => ({ label: 'Coins left' }),
    autoMove: () => ({ n: 1 }),
  };
  const plant = (s: S, seat: number, marker: string): S => ({
    ...s,
    hands: s.hands.map((h, i) => (i === seat ? marker : h)),
  });

  it('checkTurnRules (the hub’s) finds a view that leaks another seat’s secret', () => {
    expect(() => checkTurnRules(leaky, { games: 1, plant })).toThrow(/can see seat 1's secret/);
    const safe: TurnRules<S, { n: number }, Json> = {
      ...leaky,
      view: (s, seat) => ({ mine: seat === null ? '' : (s.hands[seat] ?? '') }),
    };
    expect(checkTurnRules(safe, { games: 2, plant }).games).toBe(2);
  });

  it('checkTurnRules needs a way to move, and reports an illegal computer move', () => {
    const noAuto: TurnRules<S, { n: number }, Json> = { ...leaky };
    delete noAuto.autoMove;
    expect(() => checkTurnRules(noAuto, { games: 1 })).toThrow(/autoMove|randomMove/);
    const illegal: TurnRules<S, { n: number }, Json> = { ...leaky, view: () => ({}), apply: () => ({ error: 'nope' }) };
    expect(() => checkTurnRules(illegal, { games: 1 })).toThrow(/illegal move/);
  });

  it('the adapter opens games through hub.turns; nudge is once a day in the UI', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    const turns = createTurns(fake);
    expect(turns.link).toBeNull();
    const game = await turns.open('g1');
    expect(fake.log.last('turns.open')?.args[0]).toBe('g1');
    expect(fake.resume.blockedBy).toBe('turns');
    let t = 0;
    const nudge = nudger(game, () => t);
    expect(nudge()).toBe(true);
    expect(nudge()).toBe(false);
    t = 25 * 3600 * 1000;
    expect(nudge()).toBe(true);
    game.close();
    expect(fake.resume.blockedBy).toBeNull();
  });
});
