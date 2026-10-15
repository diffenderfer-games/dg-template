/**
 * daily-puzzle kit: the seeded integer RNG and the hub's per-day seed.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * Everything a puzzle generator or solver draws comes from one `Rng` made from
 * the day's seed: never `Math.random`, `Date`, locale or `Intl`.
 */

/** A seeded generator of floats in [0, 1). */
export type Rng = () => number;

/** mulberry32: a small, fast 32-bit PRNG. The same seed gives the same sequence on every device. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix a few integers into one 32-bit seed (for sub-streams: `hashSeed(seed, attempt)`). */
export function hashSeed(...parts: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/**
 * The hub's seed for a (game, day): FNV-1a over `game#day`, the same function
 * the hub runs (`seedForDay` in the hub contract). Use it in tests, replays and
 * as the offline fallback, so an offline day is the same puzzle as the hub's.
 */
export function seedForDay(game: string, day: string): number {
  let hash = 2166136261 >>> 0;
  const input = `${game}#${day}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A whole number in [lo, hi], both inclusive. */
export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** One item of a non-empty list. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('pick: empty list');
  return items[Math.floor(rng() * items.length)];
}

/** Shuffle `items` in place (Fisher-Yates) and return it. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = items[i];
    items[i] = items[j];
    items[j] = t;
  }
  return items;
}

/** One value, chosen in proportion to its weight (weights > 0). */
export function weighted<T>(rng: Rng, entries: readonly { readonly value: T; readonly weight: number }[]): T {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (!(total > 0)) throw new RangeError('weighted: no positive weight');
  let roll = rng() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll < 0) return e.value;
  }
  return entries[entries.length - 1].value;
}
