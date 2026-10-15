import { describe, expect, it } from 'vitest';
import { createStore, scopedKey } from '../../../src/kit/core/index.ts';
import { fakeStorage, throwingStorage } from '../../../src/kit/testing/index.ts';

describe('store: storage that never throws', () => {
  it('reads and writes JSON and text', () => {
    const kv = fakeStorage();
    const s = createStore(() => kv);
    expect(s.setJson('a', { n: 1, list: [true, null] })).toBe(true);
    expect(s.getJson('a')).toEqual({ n: 1, list: [true, null] });
    expect(s.getText('missing')).toBeNull();
    expect(s.getJson('missing')).toBeUndefined();
  });

  it('survives storage that throws on every access (private mode)', () => {
    const s = createStore(() => throwingStorage());
    expect(s.setText('a', 'x')).toBe(false);
    expect(s.getText('a')).toBeNull();
    expect(s.getJson('a')).toBeUndefined();
    expect(s.keys('')).toEqual([]);
    expect(() => s.remove('a')).not.toThrow();
  });

  it('survives a backing getter that throws, and no storage at all', () => {
    const boom = createStore(() => {
      throw new Error('denied');
    });
    expect(boom.getText('a')).toBeNull();
    expect(createStore(() => null).setText('a', 'b')).toBe(false);
  });

  it('ignores stored text that is not JSON', () => {
    const s = createStore(() => fakeStorage({ bad: '{nope' }));
    expect(s.getJson('bad')).toBeUndefined();
  });

  it('lists keys by prefix', () => {
    const s = createStore(() => fakeStorage({ 'g:a': '1', 'g:b': '2', 'other:c': '3' }));
    expect(s.keys('g:').sort()).toEqual(['g:a', 'g:b']);
  });

  it('scopes keys by game, name and account (tetrablox/dumplings scopedKey)', () => {
    expect(scopedKey('mygame', 'profile', 42)).toBe('mygame:profile::u42');
    expect(scopedKey('mygame', 'profile', null)).toBe('mygame:profile::uanon');
  });
});
