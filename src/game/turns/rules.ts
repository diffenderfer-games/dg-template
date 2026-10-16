/**
 * The rules module the hub runs on its server for its online games (multiplayer.md §16.2). (GAME: yours to edit.)
 *
 * Pure: no DOM, no hub, no Math.random, no Date, no imports at all after
 * bundling (`npm run build:rules`, part of `npm run build` → dist-rules/rules.mjs; the hub loads its
 * default export). Types only come from the kit (`import type`), so nothing is
 * bundled. The hub owns the RNG and passes it in.
 *
 * To play it online, declare it in package.json `game.turns` (docs/kit/turns.md).
 * Tests: tests/game/turns.test.ts (the hub's checkTurnRules).
 *
 * TODO(game): your rules. The placeholder below only passes the turn: every
 * move is `{ pass: true }`, and the game ends after `MOVES` moves (the last
 * mover wins), so the kit's screens and suites have a game to play.
 */
import type { TurnRules } from '../../kit/turns/rules.ts';

const MOVES = 6;

/** The state (JSON, at most 64 KB). TODO(game): your state, with every secret in it. */
export type TurnState = { turn: number; seats: number; moves: number; winner: number | null };

/** A move. TODO(game): yours. */
export type TurnMove = { pass: true };

/** What a seat sees. TODO(game): hide what that seat may not see. */
export type TurnView = { turn: number; moves: number; winner: number | null };

export const rules: TurnRules<TurnState, TurnMove, TurnView> = {
  version: 1,
  setup: ({ seats }) => ({ turn: 0, seats, moves: 0, winner: null }),
  view: (s) => ({ turn: s.turn, moves: s.moves, winner: s.winner }),
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  apply(s, seat, move) {
    if (seat !== s.turn) return { error: 'not_your_turn' };
    if (move.pass !== true) return { error: 'bad_move' };
    const moves = s.moves + 1;
    return { state: { ...s, moves, turn: (s.turn + 1) % s.seats, winner: moves >= MOVES ? seat : null } };
  },
  outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
  progress: (s) => ({ label: s.winner === null ? `Move ${s.moves + 1}` : 'Game over', fraction: s.moves / MOVES }),
  autoMove: () => ({ pass: true }),
};

export default rules;
