/**
 * kit/testing: in-memory Storage fakes (and one that throws, like private mode).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Test-only: imported by tests, never by the game, so the build tree-shakes it out.
 */

import type { KeyValue } from '../core/store.ts';

/** A Map-backed `Storage`. */
export function fakeStorage(initial: Record<string, string> = {}): KeyValue & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    dump: () => Object.fromEntries(map),
  };
}

/** A `Storage` whose every call throws (Safari private mode, blocked site data). */
export function throwingStorage(): KeyValue {
  const fail = (): never => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  return {
    get length(): number {
      return fail();
    },
    getItem: fail,
    setItem: fail,
    removeItem: fail,
    key: fail,
  };
}
