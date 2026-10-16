// The online rules' own tests (GAME: yours to edit; `new-game --no-online` deletes this file).
// TODO(game): test your match: the same seed gives the same match, computer players, bad input, a winner.
import { describe, expect, it } from 'vitest';
import { createOnline } from '../../src/game/online.ts';

const game = createOnline({ render: () => undefined });

describe('online rules', () => {
  it('the same seed gives the same match on every peer', () => {
    const a = game.start({ seats: [1, 2], seed: 9 });
    const b = game.start({ seats: [1, 2], seed: 9 });
    for (let i = 0; i < 300; i++) {
      a.step(1 / 60, new Set([1, 2]));
      b.step(1 / 60, new Set([1, 2]));
    }
    expect(a.view(null)).toEqual(b.view(null));
  });

  it('bad input is refused; a backup restores the match exactly', () => {
    const m = game.start({ seats: [1, 2], seed: 2 });
    expect(m.apply(1, 'not an object')).toBe(false);
    const r = game.restore(m.backup());
    expect(r?.view(null)).toEqual(m.view(null));
  });
});
