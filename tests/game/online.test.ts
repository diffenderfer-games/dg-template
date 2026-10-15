// The online rules' own tests (GAME: yours to edit; `new-game --no-online` deletes this file).
import { describe, expect, it } from 'vitest';
import { createOnline } from '../../src/game/online.ts';

const game = createOnline({ input: () => null, render: () => undefined });

describe('online rules (Coin Party)', () => {
  it('the same seed gives the same match on every peer', () => {
    const a = game.start({ seats: [1, 2], seed: 9 });
    const b = game.start({ seats: [1, 2], seed: 9 });
    for (let i = 0; i < 300; i++) {
      a.step(1 / 60, new Set([1, 2]));
      b.step(1 / 60, new Set([1, 2]));
    }
    expect(a.view(null)).toEqual(b.view(null));
  });

  it('computer players collect coins and someone wins; the result names the winner', () => {
    const m = game.start({ seats: [1, 2, 3], seed: 4 });
    for (let i = 0; i < 60 * 120 && m.outcome() === null; i++) m.step(1 / 60, new Set([1, 2, 3]));
    expect(m.outcome()?.winners).toHaveLength(1);
  });

  it('table options set the target (world W2 launch.table)', () => {
    const m = game.start({
      seats: [1, 2],
      seed: 1,
      table: { id: 't', type: 'quick', title: 'Quick', options: { coins: 3 } },
    });
    expect(m.view(null)).toMatchObject({ target: 3 });
  });

  it('bad input is refused; a backup restores the match exactly', () => {
    const m = game.start({ seats: [1, 2], seed: 2 });
    expect(m.apply(1, { x: 50, y: 0 })).toBe(false);
    expect(m.apply(1, { x: 1, y: 0 })).toBe(true);
    m.step(0.5, new Set());
    const r = game.restore(m.backup());
    expect(r?.view(null)).toEqual(m.view(null));
  });
});
