/**
 * kit/loop: a fixed-step simulation with interpolated rendering (GD core/loop.ts).
 * Source: dg-template src/kit/loop/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/loop.md
 *
 * `simulate(dt)` always gets the same `dt`, so a seeded game plays the same on
 * every device (races and dailies stay fair, multiplayer.md §14.3). `render(alpha)`
 * runs every frame with how far between two steps the frame falls. While
 * `paused()` the loop doesn't simulate but keeps rendering, so a pause screen
 * can animate.
 */
import { realClock, type Clock } from '../core/clock.ts';

/** How the loop runs. */
export type FixedLoopOptions = {
  /** Seconds per step (default 1/60). */
  dt?: number;
  /** At most this many seconds are simulated per frame (default 0.25): a long stall doesn't spiral. */
  maxFrame?: number;
  simulate(dt: number): void;
  render(alpha: number): void;
  paused?(): boolean;
  clock?: Clock;
};

/** A fixed-step loop, driven by the clock's frames (or by `frame(nowMs)` from a renderer's ticker). */
export class FixedLoop {
  private readonly o: FixedLoopOptions;
  private dt: number;
  private acc = 0;
  private last: number | null = null;
  private cancel: (() => void) | null = null;
  /** Steps simulated so far. */
  steps = 0;

  constructor(o: FixedLoopOptions) {
    this.o = o;
    this.dt = o.dt ?? 1 / 60;
  }

  get running(): boolean {
    return this.cancel !== null;
  }

  /** Change the step (rarely: a slow-motion mode). */
  setDt(dt: number): void {
    this.dt = dt;
  }

  /** Run one frame at `nowMs`. */
  frame(nowMs: number): void {
    const elapsed = this.last === null ? 0 : (nowMs - this.last) / 1000;
    this.last = nowMs;
    if (this.o.paused?.() === true) {
      this.acc = 0;
    } else {
      this.acc += Math.min(Math.max(0, elapsed), this.o.maxFrame ?? 0.25);
      while (this.acc >= this.dt) {
        this.o.simulate(this.dt);
        this.steps++;
        this.acc -= this.dt;
      }
    }
    this.o.render(this.acc / this.dt);
  }

  /** Start driving frames from the clock (requestAnimationFrame). */
  start(): void {
    if (this.cancel) return;
    const clock = this.o.clock ?? realClock;
    const tick = (now: number): void => {
      this.cancel = clock.frame(tick);
      this.frame(now);
    };
    this.cancel = clock.frame(tick);
  }

  stop(): void {
    this.cancel?.();
    this.cancel = null;
    this.last = null;
    this.acc = 0;
  }
}

/** A variable-dt game's frame time in seconds, clamped (default 0.05 s). */
export function clampDt(ms: number, max = 0.05): number {
  return Math.min(Math.max(0, ms / 1000), max);
}
