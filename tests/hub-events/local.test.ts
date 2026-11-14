// Local play (docs/kit/local.md): 2–4 players on this screen join on the sheet, play a 'local' game that
// records nothing, play again with the same players, pause when a pad comes out, and give the seats back.
import { describe, expect, it } from 'vitest';
import type { FakeHub, FakeSeats } from '../../src/kit/testing/index.ts';
import { bootGame, PROBE } from './_support/harness.ts';

/** Boot with the client's seats and the game's own `local` spec (or a stand-in: the kit's part is what is tested). */
async function bootLocal(): Promise<Awaited<ReturnType<typeof bootGame>> & { seats: FakeSeats }> {
  let seats: FakeSeats | null = null;
  const g = await bootGame({
    before: (f: FakeHub) => void (seats = f.input.enableSeats()),
    patch: { local: PROBE.local ?? { max: 4 } },
  });
  if (seats === null) throw new Error('no seats');
  return { ...g, seats };
}

/** Open the join sheet, seat `n` pads and start. */
async function playLocal(g: Awaited<ReturnType<typeof bootLocal>>, n = 2): Promise<boolean> {
  const started = g.handle.session.newLocal();
  await g.settle();
  for (let i = 0; i < n; i++) g.seats.join();
  g.press('join-start');
  const go = await started;
  await g.settle();
  return go;
}

describe('local play (hub.input.seats)', () => {
  it('the join sheet seats the players; the game is a local one with them in seat order', async () => {
    const g = await bootLocal();
    expect(typeof g.handle.session.newLocal).toBe('function');
    expect(await playLocal(g, 3)).toBe(true);
    expect(g.hook.mode()).toBe('local');
    expect(g.hook.screen()).toBe('play');
    expect(g.calls.last('newRun')?.args[0]).toMatchObject({ mode: 'local' });
  });

  it('records nothing: no boards, stats, profile or Continue', async () => {
    const g = await bootLocal();
    await playLocal(g);
    g.hook.addScore?.(50);
    g.hook.pause?.();
    await g.settle();
    g.hook.resume?.();
    g.hook.solveNow?.();
    await g.frames(3);
    expect(g.hook.screen()).toBe('result');
    expect(g.fake.log.count('submitScore')).toBe(0);
    expect(g.fake.log.count('incrStat')).toBe(0);
    expect(g.fake.log.count('resume.save')).toBe(0);
    expect(g.calls.count('onResult')).toBe(0);
  });

  it('Play again keeps the same players; the title gives the seats back', async () => {
    const g = await bootLocal();
    await playLocal(g);
    g.hook.solveNow?.();
    await g.frames(3);
    g.press('play-again');
    await g.settle();
    expect(g.hook.mode()).toBe('local');
    expect(g.calls.count('newRun')).toBe(2);
    expect(g.seats.closed).toBe(false);
    g.hook.toTitle?.();
    await g.settle();
    expect(g.seats.closed).toBe(true);
    expect(g.hook.mode()).toBeNull();
  });

  it('the title with keepSeats holds the players for the join sheet again (newLocal({ keep }))', async () => {
    const g = await bootLocal();
    await playLocal(g, 3);
    g.handle.session.toTitle({ keepSeats: true });
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.hook.mode()).toBeNull();
    expect(g.seats.closed).toBe(false);
    expect(g.seats.count).toBe(3);
    const again = g.handle.session.newLocal({ keep: true });
    await g.settle();
    expect(g.ui.querySelectorAll('[data-testid^="join-slot-"][data-state="joined"]')).toHaveLength(3);
    g.press('join-start');
    expect(await again).toBe(true);
    expect(g.hook.mode()).toBe('local');
    expect(g.seats.count).toBe(3);
  });

  it('the sheet can sit in an element of the game', async () => {
    const g = await bootLocal();
    const host = document.createElement('div');
    g.ui.appendChild(host);
    const started = g.handle.session.newLocal({ host });
    await g.settle();
    expect(host.querySelector('[data-testid="join-sheet"][data-hosted]')).not.toBeNull();
    g.press('join-back');
    expect(await started).toBe(false);
    expect(g.seats.closed).toBe(true);
  });

  it('backing out of the sheet starts nothing and gives the seats back', async () => {
    const g = await bootLocal();
    const started = g.handle.session.newLocal();
    await g.settle();
    g.seats.join();
    g.press('join-back');
    expect(await started).toBe(false);
    expect(g.seats.closed).toBe(true);
    expect(g.hook.screen()).toBe('title');
    expect(g.calls.count('newRun')).toBe(0);
  });

  it('a pad coming out pauses and says who', async () => {
    const g = await bootLocal();
    await playLocal(g);
    g.seats.plug(1, false);
    await g.settle();
    expect(g.hook.screen()).toBe('pause');
    expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toContain('Player 2');
  });

  it('a normal game afterwards gives the seats back', async () => {
    const g = await bootLocal();
    await playLocal(g);
    await g.start();
    expect(g.hook.mode()).toBe('normal');
    expect(g.seats.closed).toBe(true);
  });

  it('a client without seats offers none', async () => {
    const g = await bootGame({ patch: { local: { max: 4 } } });
    expect(await g.handle.session.newLocal()).toBe(false);
    expect(g.hook.screen()).toBe('title');
  });
});
