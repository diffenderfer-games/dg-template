/**
 * Online play in hub rooms: Coin Party, everyone in one arena, first to the target wins.
 * (GAME: yours to edit; `new-game --no-online` deletes it.)
 *
 * The host's browser runs these rules (pure functions of state, seat and
 * input); guests send their stick and draw the views the host sends. The
 * kit does the rest: launches, the lobby, invites, busy/quiet, presence,
 * chat, computer players for away seats, host backups (docs/kit/online.md).
 * Declare `game.multiplayer` in package.json.
 */
import { onlineGame, type MatchStart, type OnlineGame } from '../kit/online/types.ts';
import type { Json } from '../kit/core/index.ts';
import { SeededRng } from '../kit/rng/index.ts';
import { ARENA, TUNING } from './config.ts';
import type { OnlineView, Vec } from './state.ts';

/** One player in the arena. */
export type OnlinePlayer = { id: number; x: number; y: number; score: number; dx: number; dy: number };

/** The host's state. TODO(game): your match state (JSON). */
export type OnlineState = { rng: number; players: OnlinePlayer[]; coin: Vec; target: number; winner: number | null };

/** A player's input: the stick. */
export type OnlineInput = { x: number; y: number };

const isObj = (x: Json): x is { [k: string]: Json } => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: Json | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const isVec = (x: Json | undefined): x is Vec => x !== undefined && isObj(x) && isNum(x.x) && isNum(x.y);
const isPlayer = (x: Json): boolean => isObj(x) && isNum(x.id) && isNum(x.score) && isNum(x.x) && isNum(x.y);

function placeCoin(s: OnlineState): void {
  const rng = SeededRng.restore(s.rng);
  s.coin = { x: 60 + rng.next() * (ARENA.width - 120), y: 60 + rng.next() * (ARENA.height - 120) };
  s.rng = rng.snapshot();
}

/** The online rules, drawn by `render` with this player's stick from `input`. */
export function createOnline(o: {
  input: () => OnlineInput | null;
  render: (view: OnlineView | null, me: number) => void;
}): OnlineGame {
  return onlineGame<OnlineState, OnlineView, OnlineInput>({
    minPlayers: 2,
    start(m: MatchStart) {
      const coins = m.table?.options?.coins;
      const s: OnlineState = {
        rng: new SeededRng(m.seed).snapshot(),
        players: m.seats.map((id, i) => ({
          id,
          x: 200 + ((i * 400) % (ARENA.width - 300)),
          y: ARENA.height / 2,
          score: 0,
          dx: 0,
          dy: 0,
        })),
        coin: { x: 0, y: 0 },
        target: typeof coins === 'number' ? coins : 10,
        winner: null,
      };
      placeCoin(s);
      return s;
    },
    apply(s, from, input) {
      const p = s.players.find((q) => q.id === from);
      if (!p) return;
      const len = Math.hypot(input.x, input.y);
      const k = len > 1 ? 1 / len : 1;
      p.dx = input.x * k;
      p.dy = input.y * k;
    },
    step(s, dt) {
      if (s.winner !== null) return;
      const half = TUNING.playerHalf;
      for (const p of s.players) {
        p.x = Math.min(ARENA.width - half, Math.max(half, p.x + p.dx * TUNING.speed * dt));
        p.y = Math.min(ARENA.height - half, Math.max(half, p.y + p.dy * TUNING.speed * dt));
        if (Math.hypot(p.x - s.coin.x, p.y - s.coin.y) < TUNING.pickup) {
          p.score++;
          placeCoin(s);
          if (p.score >= s.target) s.winner = p.id;
        }
      }
    },
    computer(s, seat) {
      const p = s.players.find((q) => q.id === seat);
      if (!p) return null;
      const dx = s.coin.x - p.x;
      const dy = s.coin.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: (dx / len) * 0.8, y: (dy / len) * 0.8 };
    },
    view: (s) => ({
      players: s.players.map(({ id, x, y, score }) => ({ id, x, y, score })),
      coin: s.coin,
      target: s.target,
      winner: s.winner,
    }),
    outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
    input: () => o.input(),
    render: (v, me) => o.render(v, me),
    isState: (x): x is OnlineState =>
      isObj(x) &&
      isNum(x.rng) &&
      Array.isArray(x.players) &&
      x.players.every(isPlayer) &&
      isVec(x.coin) &&
      isNum(x.target),
    isView: (x): x is OnlineView =>
      isObj(x) && Array.isArray(x.players) && x.players.every(isPlayer) && isVec(x.coin) && isNum(x.target),
    isInput: (x): x is OnlineInput =>
      isObj(x) && isNum(x.x) && isNum(x.y) && Math.abs(x.x) <= 1.5 && Math.abs(x.y) <= 1.5,
  });
}
