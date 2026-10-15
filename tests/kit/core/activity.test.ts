import { describe, expect, it, vi } from 'vitest';
import { createActivity, Emitter } from '../../../src/kit/core/index.ts';

describe('activity: what the player is doing', () => {
  it('daily, race and online are isolated from normal progress; normal and menus are not', () => {
    const a = createActivity();
    const seen: (string | null)[] = [];
    a.on((m) => seen.push(m));
    expect(a.isolated()).toBe(false);
    for (const m of ['daily', 'race', 'online'] as const) {
      a.set(m);
      expect(a.isolated()).toBe(true);
    }
    a.set('normal');
    expect(a.isolated()).toBe(false);
    a.set('normal');
    expect(seen).toEqual(['daily', 'race', 'online', 'normal']);
  });
});

describe('Emitter', () => {
  it('delivers, unsubscribes and survives a throwing listener', () => {
    const e = new Emitter<{ ping: number }>();
    const got: number[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    e.on('ping', () => {
      throw new Error('bad listener');
    });
    const off = e.on('ping', (n) => got.push(n));
    e.emit('ping', 1);
    off();
    e.emit('ping', 2);
    spy.mockRestore();
    expect(got).toEqual([1]);
    expect(e.count('ping')).toBe(1);
  });
});
