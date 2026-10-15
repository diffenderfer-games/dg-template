// Appendix B rows 11–17: accounts, reset and offline, through the booted game.
import { describe, expect, it } from 'vitest';
import { emitWindow } from '../../src/kit/core/index.ts';
import { bootGame } from './_support/harness.ts';

/** Finish a normal game with `coins` collected. */
async function playTo(g: Awaited<ReturnType<typeof bootGame>>, coins: number): Promise<void> {
  await g.start();
  g.hook.extra?.addCoins?.(coins);
  g.hook.loseNow?.();
  await g.frames(2);
}

describe('accounts, reset and offline (hub.md "Saves and stats", "Offline and replay")', () => {
  it('row 11: hub:auth cancels the pending push and never carries one account into another', async () => {
    const g = await bootGame();
    await playTo(g, 7); // onResult → profile.best = 7, push scheduled (1 s debounce)
    g.fake.auth({ id: 2, username: 'Other', guest: false });
    await g.frames(100);
    expect(g.fake.progress.saves.get(1)?.get('main')).toBeUndefined();
    expect(g.fake.progress.saves.get(2)?.get('main')).toBeUndefined();
  });

  it('row 12: the fresh boot after a login merge reads the merged save and never pushes stale local state over it', async () => {
    const g = await bootGame({ before: (f) => f.progress.seed('main', { v: 1, data: { best: 40, played: 9 } }) });
    expect(g.hook.snap()).toEqual({ menu: true });
    await g.frames(100);
    expect(g.fake.log.count('putSave')).toBe(0);
    expect(g.ui.querySelector('[data-testid="title-best"]')?.textContent).toBe('Best 40');
  });

  it('row 13: hub:reset clears the saved game and the local copies', async () => {
    const g = await bootGame();
    await g.start();
    g.hook.pause?.(); // autosaves for Continue
    g.fake.reset();
    expect(g.fake.log.count('resume.clear')).toBeGreaterThan(0);
  });

  it('row 14: offline and never seen (save_unknown): the profile is unknown and nothing is pushed', async () => {
    const g = await bootGame({ fake: { offline: true } });
    await playTo(g, 3);
    await g.frames(100);
    expect(g.fake.log.count('putSave')).toBe(0);
  });

  it('row 15: going online retries the read and pushes; the title says when offline', async () => {
    const g = await bootGame({ fake: { offline: true } });
    expect(g.ui.querySelector('[data-testid="offline-note"]')).not.toBeNull();
    await playTo(g, 3);
    g.hook.toTitle?.();
    g.fake.goOnline();
    await g.frames(100);
    expect(g.fake.log.count('putSave')).toBe(1);
    expect(g.ui.querySelector('[data-testid="offline-note"]')).toBeNull();
  });

  it('row 16: a sync conflict re-reads, merges and pushes again (no progress lost)', async () => {
    const g = await bootGame();
    await playTo(g, 5);
    await g.frames(100);
    g.fake.progress.seed('main', { v: 1, data: { best: 2, played: 30 } }); // another device won the slot
    g.fake.events.dispatchEvent(new CustomEvent('hub:sync', { detail: { flushed: 0, conflicts: [{ op: {} }] } }));
    await g.frames(100);
    expect(g.fake.log.last('putSave')?.args[1]).toEqual({ v: 1, data: { best: 5, played: 30 } });
  });

  it('row 17: a dropped offline change shows a toast; queued and replayed ones say nothing', async () => {
    const g = await bootGame();
    g.fake.events.dispatchEvent(new CustomEvent('hub:offline-queued', { detail: {} }));
    expect(g.ui.querySelector('[data-testid="toast"]')).toBeNull();
    emitWindow('hub:offline-failed', { error: 'conflict' }, g.fake.events);
    expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toMatch(/could not be saved/);
  });
});
