/**
 * kit/testing: the hub's local seats (`hub.input.seats`), driven by the test.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * `hub.input.enableSeats()` gives a FakeInput the client's `seats()`; the returned FakeSeats joins
 * devices, holds inputs per seat, presses raw pad buttons and unplugs pads, as the hub's seats would
 * (docs/hub.md "Local seats").
 */
import type {
  KitLocalSeats,
  KitSeat,
  KitSeatDevice,
  KitSeatEvents,
  KitSeatInput,
  KitSeatsOptions,
} from '../core/planned.ts';
import { Emitter } from '../core/emitter.ts';

/** One fake seat. */
type FakeSeat = {
  device: KitSeatDevice;
  connected: boolean;
  held: Map<string, number>;
  downs: Set<string>;
  pad: Set<number>;
};

/** The fake seats, plus drivers. */
export class FakeSeats implements KitLocalSeats {
  max = 4;
  options: KitSeatsOptions = {};
  closed = false;
  rumbles: { seat: number; effect: { strength?: number; weak?: number; ms?: number } | undefined }[] = [];
  private seats: FakeSeat[] = [];
  private isJoiningNow = false;
  private readonly events = new Emitter<KitSeatEvents>();

  /** Open afresh (what `hub.input.seats(options)` does). */
  reopen(options: KitSeatsOptions = {}): this {
    this.options = options;
    this.max = options.max ?? 4;
    this.seats = [];
    this.closed = false;
    this.isJoiningNow = false;
    this.rumbles = [];
    return this;
  }

  get list(): readonly KitSeat[] {
    return this.seats.map((seat, index) => ({ index, device: seat.device, connected: seat.connected }));
  }

  get count(): number {
    return this.seats.length;
  }

  get isJoining(): boolean {
    return this.isJoiningNow;
  }

  joining(isOn: boolean): void {
    this.isJoiningNow = isOn;
  }

  seat(index: number): KitSeatInput {
    const seat = (): FakeSeat | undefined => this.seats[index];
    const value = (name: string): number => (seat()?.connected === false ? 0 : (seat()?.held.get(name) ?? 0));
    return {
      value,
      down: (name) => seat()?.downs.has(name) === true,
      up: () => false,
      pressed: (name) => value(name) >= 0.5,
      axis: (name, positive) => (positive === undefined ? value(name) : value(positive) - value(name)),
      vector: (name) => ({ x: value(`${name}.x`), y: value(`${name}.y`), mag: 0 }),
      padDown: (button) => seat()?.pad.has(button) === true,
    };
  }

  remove(index: number): void {
    const left = this.list[index];
    if (left === undefined) return;
    this.seats.splice(index, 1);
    this.events.emit('leave', left);
    this.events.emit('change', this.list);
  }

  rumble(index: number, effect?: { strength?: number; weak?: number; ms?: number }): void {
    this.rumbles.push({ seat: index, effect });
  }

  on<Name extends keyof KitSeatEvents>(event: Name, listener: (payload: KitSeatEvents[Name]) => void): () => void {
    return this.events.on(event, listener);
  }

  close(): void {
    this.closed = true;
    this.isJoiningNow = false;
    this.seats = [];
  }

  // ---- drivers ----------------------------------------------------------------

  /** A device takes the next seat (only while joining, as the hub's A/Start does). Returns its index or -1. */
  join(
    device: KitSeatDevice = { kind: 'pad', pad: this.seats.length, id: 'Xbox Wireless Controller (STANDARD GAMEPAD)' },
  ): number {
    if (!this.isJoiningNow || this.closed || this.seats.length >= this.max) return -1;
    this.seats.push({ device, connected: true, held: new Map(), downs: new Set(), pad: new Set() });
    const seat = this.list.at(-1);
    if (seat !== undefined) {
      this.events.emit('join', seat);
      this.events.emit('change', this.list);
    }
    return this.seats.length - 1;
  }

  /** Hold an input on a seat (`vector('move')` reads `move.x` / `move.y`). */
  hold(index: number, name: string, value = 1): void {
    this.seats[index]?.held.set(name, value);
  }

  /** An input goes down this frame on a seat (until `endFrame`). */
  press(index: number, name: string): void {
    this.hold(index, name);
    this.seats[index]?.downs.add(name);
  }

  /** A raw pad button pressed this frame on a seat (`padDown`, until `endFrame`). */
  padPress(index: number, button: number): void {
    this.seats[index]?.pad.add(button);
  }

  /** The frame's edges pass. */
  endFrame(): void {
    for (const seat of this.seats) {
      seat.downs.clear();
      seat.pad.clear();
    }
  }

  /** Unplug (false) or plug back (true) a seat's pad: `lost` / `found`. */
  plug(index: number, isConnected: boolean): void {
    const seat = this.seats[index];
    if (seat === undefined || seat.connected === isConnected) return;
    seat.connected = isConnected;
    const now = this.list[index];
    if (now === undefined) return;
    this.events.emit(isConnected ? 'found' : 'lost', now);
    this.events.emit('change', this.list);
  }
}
