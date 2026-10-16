/**
 * tests/hub-events: toy online play for the kit's online suites, so they test the kit, not one game's shapes.
 * Source: dg-template tests/hub-events/ (kit v1.4). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Hub-event tests"
 *
 * The online and turns suites boot the game with these in place of its own
 * `online` and `turns` hooks (they run only for a game that declares them).
 * The game's own rules are the game's to test (tests/game/).
 */
import type { TurnsHooks } from '../../../src/kit/boot/index.ts';
import type { Json, JsonObject } from '../../../src/kit/core/json.ts';
import { onlineGame, type OnlineGame } from '../../../src/kit/online/types.ts';
import { button } from '../../../src/kit/ui/controls.ts';

/** A toy match: every seat has a score; nothing moves on its own. */
export type ToyState = { players: { id: number; score: number }[]; winner: number | null };

/** What every seat sees of the toy match. */
export type ToyView = ToyState;

const isObj = (x: Json): x is { [k: string]: Json } => typeof x === 'object' && x !== null && !Array.isArray(x);
const isToy = (x: Json): x is ToyState =>
  isObj(x) &&
  Array.isArray(x.players) &&
  x.players.every((p) => isObj(p) && typeof p.id === 'number' && typeof p.score === 'number') &&
  (x.winner === null || typeof x.winner === 'number');

/** A valid toy view (what a host sends). */
export const toyView = (players: ToyState['players'] = []): ToyView => ({ players, winner: null });

/** A toy online game: an input `{ add: n }` adds to the sender's score. */
export function toyOnline(): OnlineGame {
  return onlineGame<ToyState, ToyView, { add: number }>({
    minPlayers: 2,
    start: (m) => ({ players: m.seats.map((id) => ({ id, score: 0 })), winner: null }),
    apply(s, from, input) {
      const p = s.players.find((q) => q.id === from);
      if (p) p.score += input.add;
    },
    view: (s) => structuredClone(s),
    outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
    input: () => null,
    render: () => undefined,
    isState: isToy,
    isView: isToy,
    isInput: (x): x is { add: number } => isObj(x) && typeof x.add === 'number',
  });
}

/** A toy board for online games the hub runs: one Move button (`toy-move`) that sends `{ toy: 1 }`. */
export const toyTurns: TurnsHooks<JsonObject, JsonObject> = {
  draw(_ctx, el, board) {
    el.replaceChildren(
      button('Move', () => void board.move({ toy: 1 }), { testid: 'toy-move', disabled: !board.canMove }),
    );
  },
  testMove: (board) => (board.canMove ? { toy: 1 } : null),
};
