/**
 * kit/core: the injected clock (time, timers, frames).
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 *
 * Kit modules never read `Date.now()` or call `setTimeout` directly: they take
 * a `Clock`, so unit tests drive time with `fakeClock()` (kit/testing).
 */

/** Cancels a scheduled callback. Safe to call twice. */
export type Cancel = () => void;

/** Time and timers. */
export type Clock = {
  /** Milliseconds since the epoch. */
  now(): number;
  /** Run `fn` once after `ms`. */
  after(ms: number, fn: () => void): Cancel;
  /** Run `fn` on the next animation frame (or soon, where there are no frames). */
  frame(fn: (nowMs: number) => void): Cancel;
};

/** The real clock: `Date.now`, `setTimeout`, `requestAnimationFrame`. */
export const realClock: Clock = {
  now: () => Date.now(),
  after(ms, fn) {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
  frame(fn) {
    if (typeof requestAnimationFrame === 'function') {
      const id = requestAnimationFrame(fn);
      return () => cancelAnimationFrame(id);
    }
    const id = setTimeout(() => fn(Date.now()), 16);
    return () => clearTimeout(id);
  },
};
