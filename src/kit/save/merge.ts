/**
 * kit/save: "only grows" merge helpers for a profile's cloud and local copies.
 * Source: dg-template src/kit/save/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/save.md § "Merging"
 *
 * A profile merge must never lose progress from either side, and must give
 * the same answer however often it runs (it runs on every push, against a
 * fresh re-read). So: max, min, union, the newer of two stamped values;
 * never a sum (it would count a session twice).
 */

/** The larger of two numbers (best score, highest level). */
export function maxOf(a: number, b: number): number {
  return Math.max(a, b);
}

/** The smaller of two numbers (best time); `null` means "none yet". */
export function minOf(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/** Every item of both lists, once, in first-seen order (unlocked levels, owned skins). */
export function unionOf<T extends string | number>(a: readonly T[], b: readonly T[]): T[] {
  return [...new Set([...a, ...b])];
}

/** Either value, whichever has the larger `at` stamp (a setting chosen later wins). */
export function newerOf<T extends { at: number }>(a: T, b: T): T {
  return b.at > a.at ? b : a;
}

/** Merge two records key by key (`merge(x, y)` for keys in both; a key in only one is kept). */
export function mergeRecords<V>(
  a: Readonly<Record<string, V>>,
  b: Readonly<Record<string, V>>,
  merge: (x: V, y: V) => V,
): Record<string, V> {
  const out: Record<string, V> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const mine = out[k];
    out[k] = mine === undefined ? v : merge(mine, v);
  }
  return out;
}

/**
 * A lexicographic "more progress" check (SpaceClicker progressRank): compare
 * `[level, stars, coins]` left to right. Positive when `a` is ahead.
 */
export function compareProgress(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
