/**
 * scripts/kit/lib: reading untrusted JSON files (package.json, kit.json) without casts.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Scripts"
 */
import { readFileSync } from 'node:fs';

/** A JSON value read from disk. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** A JSON object. */
export type JsonRecord = { [key: string]: JsonValue };

/** Is `x` a plain JSON object? */
export function isRecord(x: unknown): x is JsonRecord {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Parse a JSON file into an object (throws with the path when it isn't one). */
export function readJsonFile(path: string): JsonRecord {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isRecord(parsed)) throw new Error(`${path}: expected a JSON object`);
  return parsed;
}

/** A string field, or undefined. */
export function str(x: JsonValue | undefined): string | undefined {
  return typeof x === 'string' ? x : undefined;
}

/** An object field, or undefined. */
export function rec(x: JsonValue | undefined): JsonRecord | undefined {
  return isRecord(x) ? x : undefined;
}

/** An array field, or an empty array. */
export function arr(x: JsonValue | undefined): JsonValue[] {
  return Array.isArray(x) ? x : [];
}
