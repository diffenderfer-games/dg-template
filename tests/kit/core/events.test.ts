import { describe, expect, it } from 'vitest';
import { emitWindow, onWindow } from '../../../src/kit/core/index.ts';

describe('typed hub window events', () => {
  it('parses details and unsubscribes', () => {
    const target = new EventTarget();
    const seen: unknown[] = [];
    const off = onWindow('hub:auth', (d) => seen.push(d), target);
    emitWindow('hub:auth', { user: { id: 7, guest: true } }, target);
    off();
    emitWindow('hub:auth', { user: null }, target);
    expect(seen).toEqual([{ user: { id: 7, guest: true } }]);
  });

  it('never trusts a detail from another bundle: junk becomes safe defaults', () => {
    const target = new EventTarget();
    const seen: unknown[] = [];
    onWindow('hub:race-hud', (d) => seen.push(d), target);
    onWindow('hub:auth', (d) => seen.push(d), target);
    target.dispatchEvent(new CustomEvent('hub:race-hud', { detail: { top: 'x', visible: 1 } }));
    target.dispatchEvent(new CustomEvent('hub:auth', { detail: 'nonsense' }));
    target.dispatchEvent(new Event('hub:auth'));
    expect(seen).toEqual([{ visible: false, top: 0, bottom: 0, left: 0, right: 0 }, { user: null }, { user: null }]);
  });

  it('counts sync conflicts', () => {
    const target = new EventTarget();
    let n = -1;
    onWindow('hub:sync', (d) => (n = d.conflicts), target);
    target.dispatchEvent(new CustomEvent('hub:sync', { detail: { flushed: 2, conflicts: [{}, {}] } }));
    expect(n).toBe(2);
  });
});
