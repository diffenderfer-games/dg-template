/**
 * kit/core: JSON values and guards.
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 *
 * `Json`, `stableStringify` and `jsonEqual` are the daily-puzzle kit's (one
 * definition in the kit); this file adds the guards every module needs to read
 * untrusted JSON (saves, room messages, storage) without casts.
 */
import type { Json, JsonObject } from '../daily-puzzle/json.ts';

export type { Json, JsonObject } from '../daily-puzzle/json.ts';
export { hashJson, jsonEqual, stableStringify } from '../daily-puzzle/json.ts';

/** Is `x` a JSON value (no functions, undefined, NaN or class instances)? */
export function isJson(x: unknown): x is Json {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return true;
  if (typeof x === 'number') return Number.isFinite(x);
  if (Array.isArray(x)) return x.every(isJson);
  if (typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
    return Object.values(x).every(isJson);
  }
  return false;
}

/** Is `x` a plain JSON object? */
export function isJsonObject(x: unknown): x is JsonObject {
  return typeof x === 'object' && x !== null && !Array.isArray(x) && isJson(x);
}

/** Parse JSON text into a checked value, or `undefined` when it isn't valid JSON. */
export function parseJson(text: string): Json | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isJson(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** A deep copy of a JSON value. */
export function cloneJson<T extends Json>(value: T): T {
  return structuredClone(value);
}

/** The size of a JSON value in UTF-8 bytes (what the hub measures). */
export function jsonBytes(value: Json): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** A field of an untrusted object, or `undefined`. The one place the kit reads unknown shapes. */
export function field(x: unknown, key: string): unknown {
  if (typeof x !== 'object' || x === null) return undefined;
  return Object.prototype.hasOwnProperty.call(x, key) ? Reflect.get(x, key) : undefined;
}

/** A number field, or `fallback`. */
export function numField(x: unknown, key: string, fallback = 0): number {
  const v = field(x, key);
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** A string field, or `fallback`. */
export function strField(x: unknown, key: string, fallback = ''): string {
  const v = field(x, key);
  return typeof v === 'string' ? v : fallback;
}

/** A boolean field, or `fallback`. */
export function boolField(x: unknown, key: string, fallback = false): boolean {
  const v = field(x, key);
  return typeof v === 'boolean' ? v : fallback;
}
