/**
 * three.js starter: Auto resolution. Lowers the renderer's pixel ratio when the device can't keep up and
 * remembers where it settled, so the picture doesn't flip back and forth (gulp's auto-quality.ts, cut down
 * to resolution only). (STARTER: keep as is.)
 *
 *   - **remembered**: each switch is saved (`key`, this device only) and the next page load starts there,
 *     not at the top, so a device measures once and then stays put.
 *   - **down** only when the median frame over a sustained window (2.5 s) is slower than 36 ms (under ~28 fps:
 *     a phone in low-power mode capped at 30 fps stays sharp). Two downs in a row that bought < 10% are the last (the
 *     frame isn't waiting on pixels).
 *   - **up** only after a long run (60 s) at full refresh rate (90% of frames under 18.5 ms), and never
 *     again this page's life to a ratio it already fell from.
 *   - **transients are ignored**: the first 5 s, 3 s after every switch, frames longer than 250 ms (a hidden
 *     tab, a level being built, GC) and 1 s after them.
 */
import { localStore } from '../../kit/core/store.ts';

export const ADAPTIVE_TUNING = {
  step: 0.25,
  downMs: 36,
  upP90Ms: 18.5,
  upHoldMs: 60000,
  windowMs: 2500,
  evalMs: 500,
  startHoldMs: 5000,
  settleMs: 3000,
  spikeMs: 250,
  spikeHoldMs: 1000,
};

const pct = (a: number[], p: number): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Adapts a renderer's pixel ratio between `min` and `max` from measured frame times. */
export class AdaptiveResolution {
  ratio: number;
  private readonly min: number;
  private readonly max: number;
  private readonly key: string | undefined;
  private readonly buf: { t: number; dt: number }[] = [];
  private holdUntil: number;
  private nextEval = 0;
  private comfortSince = -1;
  /** Ratios fallen from after going up to them: not tried again this page's life. */
  private readonly barred = new Set<number>();
  private lastUpFrom = -1;
  private lastDown: { before: number; judged: boolean } | null = null;
  private downBlocked = false;
  /** Downs in a row that gained < 10% (two: stop; one alone can be vsync rounding 50 ms to 50 ms). */
  private uselessDowns = 0;

  /** `key`: where to remember the ratio for this device (omit: start at `max`, remember nothing). */
  constructor(o: { min: number; max: number; key?: string }, now = performance.now()) {
    this.min = o.min;
    this.max = Math.max(o.min, o.max);
    this.key = o.key;
    const saved = o.key ? Number(localStore.getText(o.key)) : NaN;
    this.ratio = Number.isFinite(saved) && saved > 0 ? this.clamp(saved) : this.max;
    this.holdUntil = now + ADAPTIVE_TUNING.startHoldMs;
  }

  private clamp(r: number): number {
    return r2(Math.min(this.max, Math.max(this.min, r)));
  }

  /** A transient the caller knows about (a level being built): forget the window, wait `ms`. */
  hold(ms: number, now = performance.now()): void {
    this.buf.length = 0;
    this.comfortSince = -1;
    this.holdUntil = Math.max(this.holdUntil, now + ms);
  }

  /** Report a frame's duration (ms, the interval since the last one); returns the new ratio when it changed, else null. */
  sample(frameMs: number, now = performance.now()): number | null {
    const T = ADAPTIVE_TUNING;
    if (!(frameMs > 0) || frameMs > T.spikeMs) {
      this.hold(T.spikeHoldMs, now);
      return null;
    }
    if (now < this.holdUntil || (typeof document !== 'undefined' && document.hidden)) return null;
    this.buf.push({ t: now, dt: frameMs });
    while ((this.buf[0]?.t ?? now) < now - T.windowMs) this.buf.shift();
    if (now < this.nextEval) return null;
    this.nextEval = now + T.evalMs;
    const first = this.buf[0];
    if (!first || this.buf.length < 10 || now - first.t < T.windowMs * 0.8) return null;
    const dts = this.buf.map((f) => f.dt);
    const med = pct(dts, 0.5);

    // the first full window after a down: did it help? (< 10%: it isn't the pixels; stop going down)
    if (this.lastDown && !this.lastDown.judged) {
      this.lastDown.judged = true;
      if (med > this.lastDown.before * 0.9) this.downBlocked = ++this.uselessDowns >= 2;
      else this.uselessDowns = 0;
    }

    if (med > T.downMs) {
      this.comfortSince = -1;
      if (this.downBlocked || this.ratio <= this.min) return null;
      if (this.lastUpFrom >= 0) this.barred.add(this.ratio);
      this.lastUpFrom = -1;
      this.lastDown = { before: med, judged: false };
      return this.switchTo(this.clamp(this.ratio - T.step), now);
    }

    const up = this.clamp(this.ratio + T.step);
    if (up > this.ratio && !this.barred.has(up) && pct(dts, 0.9) < T.upP90Ms) {
      if (this.comfortSince < 0) this.comfortSince = first.t;
      if (now - this.comfortSince >= T.upHoldMs) {
        this.lastUpFrom = this.ratio;
        this.lastDown = null;
        this.downBlocked = false;
        this.uselessDowns = 0;
        return this.switchTo(up, now);
      }
    } else this.comfortSince = -1;
    return null;
  }

  private switchTo(ratio: number, now: number): number {
    this.ratio = ratio;
    this.hold(ADAPTIVE_TUNING.settleMs, now);
    this.nextEval = 0;
    if (this.key) localStore.setText(this.key, String(ratio));
    return ratio;
  }
}
