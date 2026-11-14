/**
 * kit/local: 2–4 players on one screen, each on their own gamepad (or one on the keyboard).
 * Source: dg-template src/kit/local/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/local.md
 *
 * The hub's seats (`hub.input.seats`, docs/hub.md "Local seats") read each
 * player's inputs from their own device. This wraps them for the game: the
 * players (name, colour, device), each one's inputs, a rumble per pad, and
 * an unplugged pad pausing the game. A local game records nothing (no boards,
 * stats, profile or Continue): `PlayMode` is `'local'`.
 */
import type { HubLike } from '../core/hub-like.ts';
import type { KitLocalSeats, KitSeat, KitSeatInput } from '../core/planned.ts';
import { padStyleOf, type PadStyle } from '../input/prompts.ts';

/** What a game declares to offer local play (`defineGame({ local })`). */
export type LocalSpec = {
  /** The most players, 2..4 (default 4). */
  max?: number;
  /** The fewest to start, 2..max (default 2). */
  min?: number;
  /** Whether one player may use the keyboard (default true). */
  keyboard?: boolean;
  /** Each player's colour, in seat order (default red, blue, yellow, green). */
  colors?: readonly string[];
};

/** The default seat colours: red, blue, yellow, green. */
export const LOCAL_COLORS: readonly string[] = ['#ff5a5f', '#3fa7ff', '#ffd23f', '#4fe08a'];

/** One local player. */
export type LocalPlayer = {
  /** 0-based, in the order they joined. */
  readonly seat: number;
  /** "Player 1"…. */
  readonly name: string;
  readonly color: string;
  /** Seat 0 is the signed-in player (their avatar). */
  readonly me: boolean;
  readonly device: 'pad' | 'keyboard';
  /** Button glyphs for a pad seat. */
  readonly padStyle: PadStyle | null;
};

/** What `newRun` gets for a local game. JSON, so a game may keep it in its state. */
export type LocalStart = { readonly players: readonly LocalPlayer[] };

/** Local play, as hooks see it (`ctx.local`). */
export type LocalPlay = {
  /** Whether this page can offer local play (the hub client has seats, the game declared `local`, not a touch-only device). */
  readonly available: boolean;
  /** Whether a local game is on now. */
  readonly active: boolean;
  /** The players (empty unless active). */
  readonly players: readonly LocalPlayer[];
  /** One player's inputs, from their own device only (reads 0 for a seat that isn't there). */
  input(seat: number): KitSeatInput;
  /** Whether a player's pad is plugged in (always true for the keyboard). */
  connected(seat: number): boolean;
  /** Rumble one player's pad (if the player allows vibration). */
  haptic(seat: number, strong?: boolean): void;
};

/** A seat that reads nothing. */
export const NO_SEAT: KitSeatInput = {
  value: () => 0,
  down: () => false,
  up: () => false,
  pressed: () => false,
  axis: () => 0,
  vector: () => ({ x: 0, y: 0, mag: 0 }),
  padDown: () => false,
};

/** Local play on a page that has none. */
export const NO_LOCAL: LocalPlay = {
  available: false,
  active: false,
  players: [],
  input: () => NO_SEAT,
  connected: () => false,
  haptic: () => undefined,
};

/** The seat count a spec allows: max in 2..4, min in 2..max. */
export function seatLimits(spec: LocalSpec): { min: number; max: number } {
  const max = Math.max(2, Math.min(4, Math.floor(spec.max ?? 4)));
  const min = Math.max(2, Math.min(max, Math.floor(spec.min ?? 2)));
  return { min, max };
}

/** The players for a list of seats. */
export function playersOf(seats: readonly KitSeat[], spec: LocalSpec, name: (n: number) => string): LocalPlayer[] {
  const colors = spec.colors ?? LOCAL_COLORS;
  return seats.map((seat) => ({
    seat: seat.index,
    name: name(seat.index + 1),
    color: colors[seat.index % colors.length] ?? LOCAL_COLORS[0] ?? '#ffffff',
    me: seat.index === 0,
    device: seat.device.kind,
    padStyle: seat.device.kind === 'pad' ? padStyleOf(seat.device.id) : null,
  }));
}

/** Whether any gamepad is plugged in. */
function hasPad(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return false;
  return navigator.getGamepads().some((pad) => pad !== null);
}

/** What the controller needs. */
export type LocalDeps = {
  hub: Pick<HubLike, 'input'>;
  spec: LocalSpec | undefined;
  /** "Player {n}". */
  name: (n: number) => string;
  /** The player allows vibration. */
  vibration: () => boolean;
  /** A pad came out mid-game: pause, say who. */
  onLost: (player: LocalPlayer) => void;
  /** It came back. */
  onFound: (player: LocalPlayer) => void;
};

/** The kit's side of local play: opens the hub's seats for the join sheet, keeps them for the game. */
export class LocalController implements LocalPlay {
  private readonly d: LocalDeps;
  private table: KitLocalSeats | null = null;
  private list: LocalPlayer[] = [];
  private isActive = false;
  private readonly offs: (() => void)[] = [];

  constructor(d: LocalDeps) {
    this.d = d;
  }

  get available(): boolean {
    return (
      this.d.spec !== undefined &&
      typeof this.d.hub.input.seats === 'function' &&
      (!this.d.hub.input.touchDevice || hasPad())
    );
  }

  get active(): boolean {
    return this.isActive;
  }

  get players(): readonly LocalPlayer[] {
    return this.isActive ? this.list : [];
  }

  get spec(): LocalSpec {
    return this.d.spec ?? {};
  }

  /**
   * The hub's seats for the join sheet: opened fresh, or with `keep` the ones still held from the local game that
   * just stopped (`hold`), players and all. Null where the client has none.
   */
  open(o: { keep?: boolean } = {}): KitLocalSeats | null {
    if (o.keep === true && this.table !== null) {
      this.hold();
      return this.table;
    }
    this.close();
    const input = this.d.hub.input;
    if (this.d.spec === undefined || typeof input.seats !== 'function') return null;
    // called on the input system: `seats` is a method (it reads its own state)
    const table = input.seats({ max: seatLimits(this.d.spec).max, keyboard: this.d.spec.keyboard ?? true });
    this.table = table;
    return table;
  }

  /** The players for the open seats now. */
  current(): LocalPlayer[] {
    return this.table === null ? [] : playersOf(this.table.list, this.spec, this.d.name);
  }

  /** The joined players start playing (`newLocal`). */
  start(): readonly LocalPlayer[] {
    const table = this.table;
    if (table === null) return [];
    table.joining(false);
    this.list = playersOf(table.list, this.spec, this.d.name);
    this.isActive = true;
    this.offs.push(
      table.on('lost', (seat) => {
        const player = this.list[seat.index];
        if (player !== undefined) this.d.onLost(player);
      }),
      table.on('found', (seat) => {
        const player = this.list[seat.index];
        if (player !== undefined) this.d.onFound(player);
      }),
    );
    return this.list;
  }

  input(seat: number): KitSeatInput {
    return this.isActive && this.table !== null && seat < this.list.length ? this.table.seat(seat) : NO_SEAT;
  }

  connected(seat: number): boolean {
    return this.table?.list[seat]?.connected ?? false;
  }

  haptic(seat: number, strong = false): void {
    if (!this.isActive || !this.d.vibration()) return;
    this.table?.rumble(seat, strong ? { strength: 0.9, ms: 180 } : { strength: 0.45, ms: 70 });
  }

  /** The local game stops but its seats stay open, players and all, for the join sheet again (`open({ keep: true })`). */
  hold(): void {
    for (const off of this.offs.splice(0)) off();
    this.table?.joining(false);
    this.list = [];
    this.isActive = false;
  }

  /** Local play ends (the title, another mode): the seats are released. */
  close(): void {
    for (const off of this.offs.splice(0)) off();
    this.table?.close();
    this.table = null;
    this.list = [];
    this.isActive = false;
  }
}
