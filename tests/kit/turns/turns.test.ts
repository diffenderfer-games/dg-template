// kit/turns: the hub's rules kit (re-exported), the hub.turns adapter and the screen's words, on the FakeHub.
import type { TurnSummary } from '@diffenderfer-games/hub';
import { createTurnRng, turnRngStateFromSeed } from '@diffenderfer-games/hub/turns';
import { describe, expect, it } from 'vitest';
import type { Json } from '../../../src/kit/core/index.ts';
import { createFakeHub, turnSummary } from '../../../src/kit/testing/index.ts';
import * as rulesEntry from '../../../src/kit/turns/rules.ts';
import {
  checkTurnRules,
  createTurns,
  handOverNames,
  nextCheckIn,
  nudger,
  seatLine,
  turnStatus,
  type TurnRules,
  type TurnSeat,
} from '../../../src/kit/turns/index.ts';

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

describe('kit/turns: who is there, in the hub’s words', () => {
  const seat = (s: Partial<TurnSeat> & { seat: number }): TurnSeat => ({
    userId: s.seat + 1,
    name: `P${s.seat}`,
    avatar: '',
    look: '',
    status: 'joined',
    isMe: false,
    ...s,
  });
  const game = (s: Partial<TurnSummary>, more: Partial<{ mySeat: number; mayActNow: boolean }> = {}) => ({
    summary: turnSummary(s),
    mySeat: more.mySeat ?? 0,
    outcome: null,
    mayActNow: more.mayActNow ?? false,
  });

  it('"Waiting for Ann…" only when connected is false; here or unknown is "Ann is playing"', () => {
    expect(seatLine(seat({ seat: 1, name: 'Ann', connected: false }))).toBe('Waiting for Ann…');
    expect(seatLine(seat({ seat: 1, name: 'Ann', connected: true }))).toBe('Ann is playing');
    expect(seatLine(seat({ seat: 1, name: 'Ann' }))).toBe('Ann is playing');
  });

  it('the status line: your turn, the others due, a move out of turn, the lobby and the end', () => {
    const seats = [
      seat({ seat: 0, isMe: true }),
      seat({ seat: 1, name: 'Ann', connected: false }),
      seat({ seat: 2, name: 'Bo' }),
    ];
    expect(turnStatus(game({ seats })).text).toBe('Your turn');
    expect(turnStatus(game({ seats, isMyTurn: false, toAct: [1, 2] })).text).toBe('Waiting for Ann… · Bo is playing');
    expect(turnStatus(game({ seats, isMyTurn: false, toAct: [2] }, { mayActNow: true })).text).toBe(
      'Bo is playing · you may move now',
    );
    expect(turnStatus(game({ phase: 'lobby', isMine: true })).kind).toBe('lobby');
    expect(turnStatus({ ...game({ phase: 'ended' }), outcome: { winners: [] } }).text).toBe("It's a draw.");
    expect(turnStatus({ ...game({ phase: 'ended' }), outcome: { winners: [1] } }).kind).toBe('lost');
  });

  it('the hand-over names the due players who are not here, and is asked again at handOverAt or the deadline', () => {
    const seats = [seat({ seat: 0, isMe: true }), seat({ seat: 1, name: 'Ann', connected: false })];
    const s = turnSummary({ seats, isMyTurn: false, toAct: [1], handOverAt: 1000, deadline: 5000 });
    expect(handOverNames(s, 0)).toBe('Ann');
    expect(nextCheckIn(s, 400)).toBe(600);
    expect(nextCheckIn(s, 2000)).toBe(3000);
    expect(nextCheckIn(s, 6000)).toBeNull();
  });

  it('the fake follows the client: canLetComputerPlay once handOverAt passed and the due player is away', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    const g = await fake.turns.open('g2');
    g.turnChanged({ isMyTurn: false, toAct: [1], handOverAt: 100 });
    expect(g.canLetComputerPlay(50)).toBe(false);
    expect(g.canLetComputerPlay(150)).toBe(false); // Sam is connected
    g.seatConnected(1, false);
    expect(g.canLetComputerPlay(150)).toBe(true);
  });

  it('the rules entry is the hub’s zod-free one: the same RNG as the conformance kit’s', () => {
    const a = createTurnRng(turnRngStateFromSeed(7));
    const b = rulesEntry.createTurnRng(rulesEntry.turnRngStateFromSeed(7));
    expect([a.int(100), a.int(100)]).toEqual([b.int(100), b.int(100)]);
  });
});
