/**
 * kit/rng: seeded randomness (mulberry32, seeds, a saveable SeededRng with named streams).
 * Source: dg-template src/kit/rng/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/rng.md
 *
 * The functions the daily-puzzle kit already has are re-exported from it (one
 * mulberry32 in the kit, with the same golden values the games use today);
 * this module adds string hashing, the one `Math.random`, named sub-streams
 * and a generator whose state can be saved with a game.
 */
import { hashSeed, mulberry32, type Rng } from '../daily-puzzle/rng.ts';

export { hashSeed, mulberry32, pick, randInt, seedForDay, shuffle, weighted } from '../daily-puzzle/rng.ts';
export type { Rng } from '../daily-puzzle/rng.ts';

/** FNV-1a over a string: a 32-bit seed from text. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A sub-seed for a named stream (`deriveSeed(seed, 'enemies')`). */
export function deriveSeed(seed: number, name: string): number {
  return hashSeed(seed, hashString(name));
}

/** A fresh random seed. The only `Math.random` in the kit: use it for normal games, never for dailies or races. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0 || 1;
}

/** A float in [lo, hi). */
export function randFloat(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

/**
 * A seeded generator whose whole state is one number, so it can be saved with
 * a game and restored exactly (`snapshot()` / `SeededRng.restore()`).
 * Same algorithm as `mulberry32`: `new SeededRng(s).next()` equals `mulberry32(s)()`.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** This generator as a plain `Rng` function (shares the state). */
  get rng(): Rng {
    return () => this.next();
  }

  /** A whole number in [lo, hi], both inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** An independent generator for a named purpose (its own sequence; doesn't advance this one). */
  fork(name: string): SeededRng {
    return new SeededRng(deriveSeed(this.state >>> 0, name));
  }

  /** The whole state (save it with the game). */
  snapshot(): number {
    return this.state >>> 0;
  }

  /** A generator continuing exactly where `snapshot` left off. */
  static restore(state: number): SeededRng {
    const r = new SeededRng(0);
    r.state = state | 0;
    return r;
  }
}

/** A plain `Rng` from a seed (alias kept for readability in game code). */
export function rngFrom(seed: number): Rng {
  return mulberry32(seed);
}
