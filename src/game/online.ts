/**
 * Online play in hub rooms: everyone scores at once, first to the target wins.
 * (GAME: yours to edit; `new-game --no-online` deletes it.)
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

/** One player. `held`: the action button was down last step (a press scores once). */
export type OnlinePlayer = { id: number; score: number; down: boolean; held: boolean };

/** The host's state. TODO(game): your match state (JSON). */
export type OnlineState = { t: number; players: OnlinePlayer[]; target: number; winner: number | null };

/** A player's input: is the action button down? */
export type OnlineInput = { press: boolean };

const isObj = (x: Json): x is { [k: string]: Json } => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: Json | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const isPlayer = (x: Json): boolean => isObj(x) && isNum(x.id) && isNum(x.score);

/** The online rules, drawn by `render` with this player's input from `input`. */
export function createOnline(o: {
  input: () => OnlineInput | null;
  render: (view: OnlineView | null, me: number) => void;
}): OnlineGame {
  return onlineGame<OnlineState, OnlineView, OnlineInput>({
    minPlayers: 2,
    start(m: MatchStart) {
      const target = m.table?.options?.target;
      return {
        t: 0,
        players: m.seats.map((id) => ({ id, score: 0, down: false, held: false })),
        target: typeof target === 'number' ? target : 30,
        winner: null,
      };
    },
    apply(s, from, input) {
      const p = s.players.find((q) => q.id === from);
      if (p) p.down = input.press;
    },
    step(s, dt) {
      if (s.winner !== null) return;
      s.t += dt;
      for (const p of s.players) {
        if (p.down && !p.held) p.score++;
        p.held = p.down;
        if (p.score >= s.target && s.winner === null) s.winner = p.id;
      }
    },
    // A computer player presses about twice a second.
    computer: (s) => ({ press: Math.floor(s.t * 4) % 2 === 0 }),
    view: (s) => ({
      players: s.players.map(({ id, score }) => ({ id, score })),
      target: s.target,
      winner: s.winner,
    }),
    outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
    input: () => o.input(),
    render: (v, me) => o.render(v, me),
    isState: (x): x is OnlineState =>
      isObj(x) && isNum(x.t) && Array.isArray(x.players) && x.players.every(isPlayer) && isNum(x.target),
    isView: (x): x is OnlineView =>
      isObj(x) && Array.isArray(x.players) && x.players.every(isPlayer) && isNum(x.target),
    isInput: (x): x is OnlineInput => isObj(x) && typeof x.press === 'boolean',
  });
}
