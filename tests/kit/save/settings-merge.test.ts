import { describe, expect, it } from 'vitest';
import { createStore } from '../../../src/kit/core/index.ts';
import {
  compareProgress,
  createSettings,
  maxOf,
  mergeRecords,
  minOf,
  newerOf,
  unionOf,
} from '../../../src/kit/save/index.ts';
import { fakeStorage } from '../../../src/kit/testing/index.ts';

describe('settings: device-local, typed, versioned (bfme settings.ts)', () => {
  const defaults = () => ({ sound: true, music: true, volume: 0.8 });

  it('starts at the defaults and persists changes', () => {
    const kv = fakeStorage();
    const s = createSettings(
      { key: 'g:settings', version: 1, defaults },
      createStore(() => kv),
    );
    expect(s.data).toEqual(defaults());
    s.set({ music: false });
    const again = createSettings(
      { key: 'g:settings', version: 1, defaults },
      createStore(() => kv),
    );
    expect(again.data.music).toBe(false);
  });

  it('keeps known keys of the right type from older or odd data, and calls migrate for old versions', () => {
    const kv = fakeStorage({
      'g:settings': JSON.stringify({ v: 1, data: { sound: false, volume: 'loud', extra: 1 } }),
    });
    const s = createSettings(
      { key: 'g:settings', version: 1, defaults },
      createStore(() => kv),
    );
    expect(s.data).toEqual({ sound: false, music: true, volume: 0.8 });
    const m = createSettings(
      { key: 'g:settings', version: 2, defaults, migrate: () => ({ sound: true, music: false, volume: 0.1 }) },
      createStore(() => kv),
    );
    expect(m.data.volume).toBe(0.1);
  });

  it('notifies listeners', () => {
    const s = createSettings(
      { key: 'k', version: 1, defaults },
      createStore(() => fakeStorage()),
    );
    const seen: boolean[] = [];
    s.onChange((d) => seen.push(d.sound));
    s.set({ sound: false });
    expect(seen).toEqual([false]);
  });
});

describe('merge helpers only grow, and are idempotent', () => {
  it('max, min, union, newer, records', () => {
    expect(maxOf(3, 5)).toBe(5);
    expect(minOf(null, 4)).toBe(4);
    expect(minOf(7, 4)).toBe(4);
    expect(unionOf(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(newerOf({ at: 1, v: 'old' }, { at: 2, v: 'new' }).v).toBe('new');
    const r = mergeRecords({ a: 1, b: 5 }, { b: 3, c: 2 }, maxOf);
    expect(r).toEqual({ a: 1, b: 5, c: 2 });
    expect(mergeRecords(r, r, maxOf)).toEqual(r);
  });

  it('compares progress lexicographically (SpaceClicker progressRank)', () => {
    expect(compareProgress([3, 1], [2, 9])).toBeGreaterThan(0);
    expect(compareProgress([3], [3, 0])).toBe(0);
  });
});
