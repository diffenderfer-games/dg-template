// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { haptic, hapticsSupported, makeBuzz } from '../../../src/kit/haptics/index.ts';

describe('haptics', () => {
  it('Android: vibrate 4 ms, or 12 ms when strong', () => {
    const calls: number[] = [];
    const nav = { vibrate: (ms: number | number[]) => (calls.push(typeof ms === 'number' ? ms : 0), true) };
    haptic(false, { nav, doc: document });
    haptic(true, { nav, doc: document });
    expect(calls).toEqual([4, 12]);
  });

  it('no vibrate and no touch: nothing, and no throw', () => {
    expect(() => haptic(true, { nav: {}, doc: null })).not.toThrow();
    expect(hapticsSupported({ nav: {}, doc: null })).toBe(false);
  });

  it('iOS: clicks the hidden switch label once, twice when strong', () => {
    Object.defineProperty(window, 'ontouchstart', { value: null, configurable: true });
    let clicks = 0;
    haptic(false, { nav: {}, doc: document, idPrefix: 'test' });
    const label = document.getElementById('test-haptic-label');
    label?.addEventListener('click', () => clicks++);
    haptic(true, { nav: {}, doc: document, idPrefix: 'test' });
    expect(clicks).toBe(2);
    expect(hapticsSupported({ nav: {}, doc: document })).toBe(true);
    Reflect.deleteProperty(window, 'ontouchstart');
  });

  it('the buzz follows the setting and is throttled', () => {
    let on = true;
    let t = 0;
    const fired: boolean[] = [];
    const buzz = makeBuzz({ enabled: () => on, now: () => t, minGapMs: 40, fire: (s) => fired.push(s) });
    buzz();
    buzz(true);
    t = 50;
    buzz(true);
    on = false;
    t = 100;
    buzz();
    expect(fired).toEqual([false, true]);
  });
});
