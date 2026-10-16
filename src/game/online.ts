/**
 * Online play in hub rooms. (GAME: yours to edit; `new-game --no-online` deletes it.)
 *
 * The host's browser runs these rules (pure functions of state, seat and
 * input); guests send their input and draw the views the host sends. The
 * kit does the rest: launches, the lobby, invites, busy/quiet, presence,
 * chat, computer players for away seats, host backups (docs/kit/online.md).
 * Declare `game.multiplayer` in package.json.
 */
import { onlineGame, type MatchStart, type OnlineGame } from '../kit/online/types.ts';
import type { Json } from '../kit/core/index.ts';
import type { OnlineView } from './state.ts';

/** The host's state. TODO(game): your match state (JSON). */
export type OnlineState = { players: { id: number; score: number }[]; winner: number | null };

/** A player's input, sent to the host. TODO(game): what a player does (a stick, a button). */
export type OnlineInput = Record<string, never>;

const isObj = (x: Json): x is { [k: string]: Json } => typeof x === 'object' && x !== null && !Array.isArray(x);
const isMatch = (x: Json): x is OnlineState =>
  isObj(x) &&
  Array.isArray(x.players) &&
  x.players.every((p) => isObj(p) && typeof p.id === 'number' && typeof p.score === 'number');

/** The online rules, drawn by `render`. */
export function createOnline(o: { render: (view: OnlineView | null, me: number) => void }): OnlineGame {
  return onlineGame<OnlineState, OnlineView, OnlineInput>({
    minPlayers: 2,
    // TODO(game): a new match from the seats and `m.seed` (`m.table?.options` from a world table).
    start: (m: MatchStart) => ({ players: m.seats.map((id) => ({ id, score: 0 })), winner: null }),
    // TODO(game): apply a player's input to the state.
    apply: () => undefined,
    // TODO(game): `step(state, dt)` for a real-time game; `computer(state, seat)` plays an away seat.
    view: (s) => ({ players: s.players, winner: s.winner }),
    outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
    // TODO(game): this player's input now (read `hub.input`), or null to send nothing.
    input: () => null,
    render: (v, me) => o.render(v, me),
    isState: isMatch,
    isView: isMatch,
    isInput: (x): x is OnlineInput => isObj(x),
  });
}
