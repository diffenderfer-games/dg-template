/**
 * three.js starter: lower the pixel ratio when frames are slow, raise it back when they're fast
 * (dinodasher render/adaptive.ts). (STARTER: keep as is.)
 */

/** Adapts a renderer's pixel ratio between `min` and `max` from measured frame times. */
export class AdaptiveResolution {
  ratio: number;
  private readonly min: number;
  private readonly max: number;
  private frames = 0;
  private total = 0;

  constructor(o: { min: number; max: number }) {
    this.min = o.min;
    this.max = o.max;
    this.ratio = o.max;
  }

  /** Report a frame's duration (ms); returns the new ratio when it changed, else null. */
  sample(frameMs: number): number | null {
    this.frames++;
    this.total += frameMs;
    if (this.frames < 60) return null;
    const avg = this.total / this.frames;
    this.frames = 0;
    this.total = 0;
    let next = this.ratio;
    if (avg > 22) next = Math.max(this.min, this.ratio - 0.25);
    else if (avg < 14) next = Math.min(this.max, this.ratio + 0.25);
    if (next === this.ratio) return null;
    this.ratio = next;
    return next;
  }
}
