/**
 * daily-puzzle kit: JSON values, a stable stringify and a puzzle hash.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * Puzzles, actions and lines are plain JSON, so they can be compared, hashed,
 * sent in `hub.daily.complete({ line })` and replayed. Declare them with `type`
 * aliases, not interfaces: only aliases are assignable to `Json`.
 */

/** A JSON value. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** A JSON object (the shape of `hub.daily.complete` metadata). */
export type JsonObject = { [key: string]: Json };

/** JSON text with object keys sorted, so equal values always give equal text. */
export function stableStringify(value: Json): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** Deep equality of two JSON values. */
export function jsonEqual(a: Json, b: Json): boolean {
  return stableStringify(a) === stableStringify(b);
}

function fnv1a(text: string, basis: number): number {
  let h = basis >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A 16-hex-digit hash of a JSON value (for generator-version snapshots). */
export function hashJson(value: Json): string {
  const text = stableStringify(value);
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return hex(fnv1a(text, 0x811c9dc5)) + hex(fnv1a(text, 0x01000193));
}
