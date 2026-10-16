/**
 * The board of the online game played over days: "take the last coin". (GAME: yours to edit.)
 *
 * The hub runs the rules (rules.ts) on its server; this page only draws the
 * view it is sent and offers the moves. The kit draws everything around it:
 * whose move it is, who is there, the hand-over to the computer, chat, the
 * rematch (docs/kit/turns.md). Delete this file and the `turns` lines in
 * hooks.ts (new-game --no-turns does) for a game without online games over days.
 */
import type { TurnsHooks } from '../../kit/boot/index.ts';
import { h } from '../../kit/ui/dom.ts';
import { button } from '../../kit/ui/controls.ts';
import type { Profile, Run } from '../state.ts';
import type { PileView } from './rules.ts';

/** The view the hub sent, checked (it is untrusted JSON). */
function pile(view: unknown): PileView | null {
  if (typeof view !== 'object' || view === null) return null;
  const coins: unknown = Reflect.get(view, 'coins');
  const turn: unknown = Reflect.get(view, 'turn');
  const winner: unknown = Reflect.get(view, 'winner');
  if (typeof coins !== 'number' || typeof turn !== 'number') return null;
  return { coins, turn, winner: typeof winner === 'number' ? winner : null };
}

/** TODO(game): draw your board and offer your moves. */
export const turns: TurnsHooks<Profile, Run> = {
  draw(_ctx, el, board) {
    const v = pile(board.view);
    if (v === null) return void el.replaceChildren();
    const takes = [1, 2, 3].map((n) =>
      button(`Take ${n}`, () => void board.move({ take: n }), {
        testid: `take-${n}`,
        disabled: !board.canMove || n > v.coins,
      }),
    );
    el.replaceChildren(
      h('p.kit-tagline', { 'data-testid': 'pile' }, `${v.coins} coins in the pile. Whoever takes the last one wins.`),
      h('div.kit-menu', {}, ...takes),
    );
  },
};
