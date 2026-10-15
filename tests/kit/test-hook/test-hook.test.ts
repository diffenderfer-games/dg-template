// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { installTestHook, type GameHookInfo } from '../../../src/kit/test-hook/index.ts';

let isReady = false;
const info: GameHookInfo = {
  slug: 'mygame',
  kit: '1.0',
  screen: () => 'title',
  paused: () => false,
  mode: () => null,
  snap: () => ({ score: 3, items: [1, 2] }),
  ready: () => isReady,
};

describe('window.__game', () => {
  it('installs read-only fields always, under one name for every game', () => {
    const hook = installTestHook(info, () => ({ solveNow: () => undefined }), { allowDrivers: false });
    expect(window.__game).toBe(hook);
    expect(hook.slug).toBe('mygame');
    expect(hook.solveNow).toBeUndefined();
  });

  it('drivers only when allowed (__HUB_TEST__, localhost or dev)', () => {
    let solved = 0;
    const hook = installTestHook(info, () => ({ solveNow: () => void solved++ }), { allowDrivers: true });
    hook.solveNow?.();
    expect(solved).toBe(1);
  });

  it('snap() is JSON-serializable and ready follows mount', () => {
    const hook = installTestHook(info, () => ({}), { allowDrivers: false });
    expect(JSON.parse(JSON.stringify(hook.snap()))).toEqual({ score: 3, items: [1, 2] });
    expect(hook.ready()).toBe(false);
    isReady = true;
    expect(hook.ready()).toBe(true);
  });
});
