/**
 * kit/live: the hooks a live game gives the kit (`GameDefinition.live`).
 * Source: dg-template src/kit/live/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/live.md § "The page flow"
 */
import type { LiveMatch } from '@diffenderfer-games/hub/live';
import type { JsonObject } from '../core/json.ts';
import type { LiveSim } from './sim.ts';

/** One player in a live match, by seat: who, and their choices (their room seat's data, the sim's `ctx.seatData`). */
export type LiveSeat = { userId: number; name: string; look: string; data: JsonObject | null };

/** A live match as it starts: the room, its players in seat order, mine, and the host's options. */
export type LiveStart = {
  room: string;
  seats: readonly LiveSeat[];
  /** My seat (-1: I'm not seated). */
  me: number;
  options: JsonObject;
};

/**
 * A live game (docs/kit/live.md): a hub room is its lobby, the hub's live
 * server runs `sim`, and the page draws it. The kit does the lobby, the
 * loading screen, joining (and joining again after a drop), presence, the
 * leave guard and the result.
 */
export type LiveRoomGame = {
  /** The sim module (src/game/live/sim.ts): the same one the live server runs. */
  sim: LiveSim;
  /** Fewest players to start (default 2). */
  minPlayers?: number;
  /** The host's options for the match now: shown in the lobby, and the sim's `ctx.options`. JSON, never text. */
  options(): JsonObject;
  /** This player's own choices (a car, a colour): their room seat, and the sim's `ctx.seatData[seat]`. */
  seat(): JsonObject;
  /**
   * The game's part of the lobby: the options as the host picked them (everyone sees them), and the
   * controls to change them (the host) and my own choices. After a change, `lobby.update()` shares
   * the new `options()` (the host) and `seat()` with the room, and the lobby is drawn again.
   */
  describe?(options: JsonObject | null, lobby: { readonly isHost: boolean; update(): void }): HTMLElement | null;
  /** Build what drawing this match needs (its world); report how far along. The kit shows a loading screen. */
  prepare(start: LiveStart, progress: (fraction: number, label: string) => void): Promise<void>;
  /** Joined (again, after a drop): play this match from now on. */
  play(match: LiveMatch, start: LiveStart): void;
  /** Each step while playing (`dt` seconds): send the input (`match.input`). */
  frame(dt: number): void;
  /** Each frame: draw (`match.view()`) and update the HUD. */
  render(): void;
  /** The play screen is up: put the HUD in `el` (the kit's HUD row, as a single-player game's `screens.hud.mount`). */
  hud?(el: HTMLElement): void;
  /** The match is over and left (the title, Leave): stop drawing it, free what it built. */
  stop(): void;
  /** The result screen: who placed where (players by user id, winner first). */
  result?(el: HTMLElement, places: readonly number[], start: LiveStart | null): void;
};
