// @vitest-environment jsdom
// kit/turns: the screen redraws only what changed, so a game's entrance animations on its rows play once.
import { describe, expect, it } from 'vitest';
import { CallLog, FakeTurnGame, turnSummary } from '../../../src/kit/testing/index.ts';
import { turnsScreen } from '../../../src/kit/turns/screen.ts';
import { h } from '../../../src/kit/ui/dom.ts';

const noop = (): void => {};
const actions = {
  start: noop,
  copyLink: noop,
  nudge: noop,
  handOver: noop,
  rematch: noop,
  leave: noop,
  back: noop,
  player: noop,
  invite: noop,
  remove: noop,
};

describe('kit/turns: the screen', () => {
  it('whose turn it is flips data-due on the same rows; a seat that changed gets a new row', () => {
    const game = new FakeTurnGame(new CallLog(), 'g1');
    const screen = turnsScreen({ title: 'T', face: () => h('span'), chat: null }, actions);
    screen.update(game, 0);
    const [mine, theirs] = [...screen.el.querySelectorAll<HTMLElement>('.kit-seat')];
    expect(mine?.dataset.due).toBe('true');

    game.summary = turnSummary({ toAct: [1], isMyTurn: false, seq: 1 });
    screen.update(game, 0);
    const after = [...screen.el.querySelectorAll<HTMLElement>('.kit-seat')];
    expect(after[0]).toBe(mine);
    expect(after[1]).toBe(theirs);
    expect(mine?.dataset.due).toBe('false');
    expect(theirs?.dataset.due).toBe('true');

    const seats = game.summary.seats.map((s) => (s.seat === 1 ? { ...s, connected: false } : s));
    game.summary = turnSummary({ seats, toAct: [1], isMyTurn: false, seq: 1 });
    screen.update(game, 0);
    const changed = [...screen.el.querySelectorAll<HTMLElement>('.kit-seat')];
    expect(changed[0]).toBe(mine);
    expect(changed[1]).not.toBe(theirs);
    expect(changed[1]?.dataset.connected).toBe('false');
    expect(changed[1]?.dataset.due).toBe('true');
  });
});
