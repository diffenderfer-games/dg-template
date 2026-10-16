/**
 * The rules module the hub runs on its server for its online games (multiplayer.md §16.2). (GAME: yours to edit.)
 *
 * Pure: no DOM, no hub, no Math.random, no Date, no imports at all after
 * bundling (`npm run build:rules`, part of `npm run build` → dist-rules/rules.mjs; the hub loads its
 * default export). Types only come from the kit (`import type`), so nothing is
 * bundled. The hub owns the RNG and passes it in. The example is "take the
 * last coin": players take 1–3 coins in turn; whoever takes the last one wins.
 *
 * To play it online, declare it in package.json `game.turns` (docs/kit/turns.md).
 * Tests: tests/game/turns.test.ts (the hub's checkTurnRules). TODO(game): your rules.
 */
import type { TurnRules } from '../../kit/turns/rules.ts';

/** The state (JSON, at most 64 KB). TODO(game): your state, with every secret in it. */
export type CoinPile = { coins: number; turn: number; seats: number; winner: number | null };

/** A move: how many coins to take. */
export type Take = { take: number };

/** What a seat sees (nothing secret in this game). */
export type PileView = { coins: number; turn: number; winner: number | null };

export const rules: TurnRules<CoinPile, Take, PileView> = {
  version: 1,
  setup: ({ seats, rng }) => ({ coins: 15 + rng.int(6), turn: 0, seats, winner: null }),
  view: (s) => ({ coins: s.coins, turn: s.turn, winner: s.winner }),
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  apply(s, seat, move) {
    if (seat !== s.turn) return { error: 'not_your_turn' };
    if (!Number.isInteger(move.take) || move.take < 1 || move.take > Math.min(3, s.coins)) return { error: 'bad_take' };
    const coins = s.coins - move.take;
    return { state: { ...s, coins, turn: (s.turn + 1) % s.seats, winner: coins === 0 ? seat : null } };
  },
  outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
  progress: (s) => ({ label: s.winner === null ? `${s.coins} coins left` : 'Game over', fraction: 1 - s.coins / 20 }),
  autoMove: (s) => ({ take: s.coins % 4 === 0 ? 1 : s.coins % 4 }),
};

export default rules;
