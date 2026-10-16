/**
 * The board of the online game the hub runs. (GAME: yours to edit.)
 *
 * The hub runs the rules (rules.ts) on its server; this page only draws the
 * view it is sent and offers the moves. The kit draws everything around it:
 * whose move it is, who is there, the hand-over to the computer, chat, the
 * rematch (docs/kit/turns.md). Delete this file and the `turns` lines in
 * hooks.ts (new-game --no-turns does) for a game without online games the hub runs.
 */
import type { TurnsHooks } from '../../kit/boot/index.ts';
import { button } from '../../kit/ui/controls.ts';
import type { Profile, Run } from '../state.ts';

/** TODO(game): draw `board.view` (untrusted JSON: check it) and offer your moves with `board.move(…)`. */
export const turns: TurnsHooks<Profile, Run> = {
  draw(_ctx, el, board) {
    el.replaceChildren(
      button('Pass', () => void board.move({ pass: true }), { testid: 'turn-pass', disabled: !board.canMove }),
    );
  },
  // The test contract (docs/kit/testing.md): a legal move for the kit's hub suite. TODO(game): one of yours.
  testMove: (board) => (board.canMove ? { pass: true } : null),
};
