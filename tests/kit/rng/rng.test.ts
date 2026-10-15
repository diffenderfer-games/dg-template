import { seedForDay as hubSeedForDay } from '@diffenderfer-games/hub-contract';
import { describe, expect, it } from 'vitest';
import {
  deriveSeed,
  hashString,
  mulberry32,
  randomSeed,
  SeededRng,
  seedForDay,
  shuffle,
} from '../../../src/kit/rng/index.ts';

describe('rng: seeded randomness', () => {
  it('mulberry32 keeps the golden values every game already uses', () => {
    const r = mulberry32(42);
    expect([r(), r(), r()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
  });

  it('SeededRng is the same sequence as mulberry32', () => {
    const a = mulberry32(1234);
    const b = new SeededRng(1234);
    for (let i = 0; i < 100; i++) expect(b.next()).toBe(a());
  });

  it('snapshot / restore continues exactly (save a game mid-way)', () => {
    const r = new SeededRng(99);
    r.next();
    r.next();
    const saved = r.snapshot();
    const expected = [r.next(), r.next(), r.next()];
    const back = SeededRng.restore(saved);
    expect([back.next(), back.next(), back.next()]).toEqual(expected);
  });

  it('fork gives independent named streams and leaves the parent alone', () => {
    const r = new SeededRng(7);
    const before = r.snapshot();
    const enemies = r.fork('enemies');
    const loot = r.fork('loot');
    expect(r.snapshot()).toBe(before);
    expect(enemies.next()).not.toBe(loot.next());
    expect(new SeededRng(7).fork('enemies').next()).toBe(new SeededRng(7).fork('enemies').next());
    expect(deriveSeed(7, 'a')).not.toBe(deriveSeed(7, 'b'));
    expect(hashString('abc')).toBe(hashString('abc'));
  });

  it("seedForDay equals the hub's own seed (offline days match online)", () => {
    const cases = [
      ['mygame', '2026-10-15'],
      ['solitaire', '2026-01-01'],
      ['x', '2030-12-31'],
    ] as const;
    for (const [game, day] of cases) expect(seedForDay(game, day)).toBe(hubSeedForDay(game, day));
    expect(seedForDay('mygame', '2026-10-15')).toBe(1106517459);
  });

  it('shuffle is unbiased (chi-square over 12k shuffles of 4)', () => {
    const rng = mulberry32(2026);
    const counts = new Map<string, number>();
    const N = 12_000;
    for (let i = 0; i < N; i++) {
      const k = shuffle(rng, [0, 1, 2, 3]).join('');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.size).toBe(24);
    const expected = N / 24;
    const chi = [...counts.values()].reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi).toBeLessThan(49.7); // p = 0.001 for 23 degrees of freedom
  });

  it('randomSeed is a positive 32-bit integer', () => {
    const s = randomSeed();
    expect(Number.isInteger(s) && s > 0 && s <= 0xffffffff).toBe(true);
  });
});
