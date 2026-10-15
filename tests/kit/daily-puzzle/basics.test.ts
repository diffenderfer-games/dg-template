import { describe, expect, it } from 'vitest';
import {
  addDays, dayRange, daysBetween, hashJson, hashSeed, isDayKey, jsonEqual, mulberry32, pick, randInt,
  seedForDay, shuffle, stableStringify, todayUTC, weighted,
} from '../../../src/kit/daily-puzzle/index.ts';

describe('rng', () => {
  it('mulberry32: same seed, same sequence, in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 50 }, () => c())).not.toEqual(xs);
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });

  it('mulberry32 is pinned (a change would change every puzzle)', () => {
    const r = mulberry32(1);
    expect([r(), r(), r()].map((x) => Math.floor(x * 1e6))).toEqual([627073, 2735, 527447]);
  });

  it('seedForDay matches the hub (FNV-1a of game#day)', () => {
    // values from the hub contract's seedForDay
    expect(seedForDay('garbage', '2026-10-14')).toBe(481827351);
    expect(seedForDay('popfour', '2026-01-01')).toBe(4119760587);
    expect(seedForDay('spacepong', '2027-02-28')).toBe(2794724383);
  });

  it('hashSeed mixes its parts in order', () => {
    expect(hashSeed(1, 2)).toBe(hashSeed(1, 2));
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
    expect(hashSeed(1, 2) >>> 0).toBe(hashSeed(1, 2));
  });

  it('randInt stays in bounds and reaches both ends', () => {
    const r = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) { const n = randInt(r, 3, 6); expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(6); seen.add(n); }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('pick, shuffle and weighted', () => {
    const r = mulberry32(9);
    expect(() => pick(r, [])).toThrow(RangeError);
    expect(['a', 'b']).toContain(pick(r, ['a', 'b']));
    const deck = Array.from({ length: 20 }, (_, i) => i);
    const s = shuffle(r, deck.slice());
    expect(s.slice().sort((x, y) => x - y)).toEqual(deck);
    expect(s).not.toEqual(deck);
    expect(() => weighted(r, [{ value: 'x', weight: 0 }])).toThrow(RangeError);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) counts[weighted(r, [{ value: 'a' as const, weight: 3 }, { value: 'b' as const, weight: 1 }])]++;
    expect(counts.a).toBeGreaterThan(counts.b * 2);
  });
});

describe('days', () => {
  it('isDayKey rejects malformed and impossible days', () => {
    expect(isDayKey('2026-10-14')).toBe(true);
    expect(isDayKey('2028-02-29')).toBe(true);
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey('2026-1-01')).toBe(false);
  });

  it('addDays crosses months, years and leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(() => addDays('nope', 1)).toThrow(RangeError);
  });

  it('daysBetween, dayRange and todayUTC', () => {
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(dayRange('2026-12-30', 3)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
    expect(todayUTC(Date.parse('2026-10-14T23:59:59Z'))).toBe('2026-10-14');
  });
});

describe('json', () => {
  it('stableStringify sorts keys at every depth', () => {
    expect(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}');
    expect(jsonEqual({ a: 1, b: null }, { b: null, a: 1 })).toBe(true);
    expect(jsonEqual([1, 2], [2, 1])).toBe(false);
  });

  it('hashJson is stable and sensitive', () => {
    const h = hashJson({ a: 1, b: [1, 2] });
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(hashJson({ b: [1, 2], a: 1 })).toBe(h);
    expect(hashJson({ a: 1, b: [2, 1] })).not.toBe(h);
  });
});
