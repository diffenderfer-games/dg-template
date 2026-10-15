/**
 * kit/online: the hooks an online game gives, and the typed-to-JSON bridge the kit runs.
 * Source: dg-template src/kit/online/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md
 *
 * Hub rooms (multiplayer.md §8): the host's browser runs the rules; guests
 * send their input and draw the views the host broadcasts. Write the rules
 * as pure functions of (state, seat, input): moving the game to turn games
 * later (kit/turns) is then a mapping, not a rewrite.
 */
import type { Json, JsonObject } from '../core/json.ts';
import type { TableLaunch } from '../core/planned.ts';

/** How a match starts (from the lobby, an invite, or a world table). */
export type MatchStart = {
  /** Seated players by user id, in seat order. */
  seats: readonly number[];
  seed: number;
  mode?: string;
  /** world.md §3.4: the table's options (jump-in rules…), when launched from a table. */
  table?: TableLaunch;
};

/** The game's online rules, typed with its own state S, view V and input M. */
export type OnlineHooks<S extends JsonObject, V extends JsonObject, M extends Json> = {
  /** Fewest players to start (default 2). */
  minPlayers?: number;
  /** The host: a new match. */
  start(m: MatchStart): S;
  /** The host: apply a player's input (validated by `isInput`). */
  apply(state: S, from: number, input: M): void;
  /** The host: advance the simulation by `dt` seconds (real-time games). */
  step?(state: S, dt: number): void;
  /** The host: the computer's input for a seat whose player is away or gone (null: skip the seat). */
  computer?(state: S, seat: number): M | null;
  /** What a seat sees (null: a spectator). Hide other seats' secrets here. */
  view(state: S, seat: number | null): V;
  /** Is the match over? (Never while a human remains without a winner: the computer keeps away seats.) */
  outcome(state: S): { winners: number[] } | null;
  /** This player's input now (sent to the host at the tick rate; null: nothing to send). */
  input(): M | null;
  /** Draw a view (everyone, the host too). */
  render(view: V | null, me: number): void;
  isState(x: Json): x is S;
  isView(x: Json): x is V;
  isInput(x: Json): x is M;
  /** Views and inputs per second (default 10). */
  tickHz?: number;
  /** Planned (world W3): a reaction from the hub's People panel. */
  onReaction?(from: number, emote: string): void;
};

/** The host's running match, with its state hidden behind JSON. */
export type HostMatch = {
  apply(from: number, input: Json): boolean;
  step(dt: number, computerSeats: ReadonlySet<number>): void;
  view(seat: number | null): Json;
  outcome(): { winners: number[] } | null;
  /** The whole state, for the successor's backup. */
  backup(): Json;
};

/** An online game as the kit runs it (no generics leak into the kit). */
export type OnlineGame = {
  minPlayers: number;
  tickHz: number;
  start(m: MatchStart): HostMatch;
  /** A successor takes over from a backup (null: not a valid state). */
  restore(backup: Json): HostMatch | null;
  input(): Json | null;
  isInput(x: Json): boolean;
  render(view: Json | null, me: number): void;
  isView(x: Json): boolean;
  onReaction?(from: number, emote: string): void;
};

/** Bridge the game's typed hooks to the kit (validate at every JSON boundary). */
export function onlineGame<S extends JsonObject, V extends JsonObject, M extends Json>(
  h: OnlineHooks<S, V, M>,
): OnlineGame {
  const host = (state: S): HostMatch => ({
    apply(from, input) {
      if (!h.isInput(input)) return false;
      h.apply(state, from, input);
      return true;
    },
    step(dt, computerSeats) {
      if (h.computer) {
        for (const seat of computerSeats) {
          const move = h.computer(state, seat);
          if (move !== null) h.apply(state, seat, move);
        }
      }
      h.step?.(state, dt);
    },
    view: (seat) => h.view(state, seat),
    outcome: () => h.outcome(state),
    backup: () => structuredClone(state),
  });
  return {
    minPlayers: h.minPlayers ?? 2,
    tickHz: h.tickHz ?? 10,
    start: (m) => host(h.start(m)),
    restore: (b) => (h.isState(b) ? host(structuredClone(b)) : null),
    input: () => h.input(),
    isInput: (x) => h.isInput(x),
    render: (v, me) => h.render(v !== null && h.isView(v) ? v : null, me),
    isView: (x) => h.isView(x),
    ...(h.onReaction ? { onReaction: (from: number, emote: string) => h.onReaction?.(from, emote) } : {}),
  };
}
