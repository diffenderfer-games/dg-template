/**
 * kit/testing: a fake clock with timers and frames you advance by hand.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Test-only: imported by tests, never by the game, so the build tree-shakes it out.
 */

import type { Cancel, Clock } from '../core/clock.ts';

type Timer = { at: number; seq: number; fn: (now: number) => void; frame: boolean };

/** A `Clock` whose time only moves when the test says so. */
export type FakeClock = Clock & {
  /** Move time forward, running due timers in order (frames run at most once per 16 ms step). */
  advance(ms: number): void;
  /** Run every pending frame callback now. */
  flushFrames(): void;
  /** How many timers and frames are waiting. */
  pending(): number;
  /** Let pending promise callbacks run (await it between steps). */
  settle(): Promise<void>;
};

/** A fake clock starting at `start` ms (default: 2026-10-15T00:00:00Z). */
export function fakeClock(start = Date.UTC(2026, 9, 15)): FakeClock {
  let now = start;
  let seq = 0;
  const timers: Timer[] = [];
  const schedule = (at: number, fn: (now: number) => void, frame: boolean): Cancel => {
    const timer: Timer = { at, seq: seq++, fn, frame };
    timers.push(timer);
    return () => {
      const i = timers.indexOf(timer);
      if (i >= 0) timers.splice(i, 1);
    };
  };
  const runDue = (limit: number): void => {
    for (;;) {
      timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = timers[0];
      if (!next || next.at > limit) return;
      timers.shift();
      now = Math.max(now, next.at);
      next.fn(now);
    }
  };
  return {
    now: () => now,
    after: (ms, fn) => schedule(now + Math.max(0, ms), () => fn(), false),
    frame: (fn) => schedule(now + 16, fn, true),
    advance(ms) {
      const target = now + ms;
      runDue(target);
      now = target;
    },
    flushFrames() {
      const frames = timers.filter((t) => t.frame);
      for (const f of frames) {
        timers.splice(timers.indexOf(f), 1);
        f.fn(now);
      }
    },
    pending: () => timers.length,
    settle: async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    },
  };
}
