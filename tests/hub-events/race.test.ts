// Appendix B rows 29–33: races (multiplayer.md §14).
import { describe, expect, it } from 'vitest';
import { bootGame } from './_support/harness.ts';

describe('races (multiplayer.md §14)', () => {
  it('row 29: start builds from seed + params only; resumed restores the stash; spectators get nothing', async () => {
    const g = await bootGame();
    g.fake.race.start({ seed: 77, params: { coins: 5 }, startAt: g.fake.clock.now() });
    expect(g.hook.mode()).toBe('race');
    expect(g.calls.last('newRun')?.args[0]).toMatchObject({ mode: 'race', seed: 77 });
    expect(g.hook.snap()).toMatchObject({ target: 5 });
    g.hook.extra?.addCoins?.(2);
    await g.frames(30); // reports (and stashes) the game
    g.fake.race.start({ seed: 77, params: { coins: 5 }, startAt: g.fake.clock.now(), resumed: true });
    expect(g.hook.snap()).toMatchObject({ score: 2 });

    const s = await bootGame();
    s.fake.race.start({ spectator: true });
    expect(s.hook.mode()).toBeNull();
  });

  it('row 30: input waits for the go (startAt)', async () => {
    const g = await bootGame();
    g.fake.race.start({ startAt: g.fake.clock.now() + 3000 });
    g.fake.input.setVector('move', { x: 1, y: 0 });
    const before = g.hook.snap();
    await g.frames(60);
    expect(g.hook.snap()).toEqual(before);
    await g.frames(160);
    expect(g.hook.snap()).not.toEqual(before);
  });

  it('row 31: end locks input; exit goes back to the title; races write no stats and no boards', async () => {
    const g = await bootGame();
    g.fake.race.start({ startAt: g.fake.clock.now() });
    g.hook.solveNow?.();
    await g.frames(3);
    expect(g.fake.log.count('race.finish')).toBe(1);
    expect(g.fake.log.count('submitScore') + g.fake.log.count('incrStat') + g.fake.log.count('maxStat')).toBe(0);
    g.fake.race.end({ winnerId: 1 });
    g.fake.race.exit();
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.hook.mode()).toBeNull();
  });

  it('row 32: status is throttled to 4 per second; a closed race goes to the title', async () => {
    const g = await bootGame();
    g.fake.race.start({ startAt: g.fake.clock.now() });
    g.fake.input.setVector('move', { x: 1, y: 0 });
    await g.frames(62); // ~1 s
    const n = g.fake.log.count('race.status');
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
    g.fake.race.close('removed');
    await g.settle();
    expect(g.hook.screen()).toBe('title');
  });

  it('row 33: the race HUD moves the play region down (hub:race-hud, --hub-race-hud-top)', async () => {
    const g = await bootGame();
    g.fake.race.start({ startAt: g.fake.clock.now() });
    g.fake.race.hud({ top: 48 });
    expect(getComputedStyle(document.documentElement).getPropertyValue('--hub-race-hud-top')).toBe('48px');
  });

  it('a race is never paused: the pause button asks "Leave race?"', async () => {
    const g = await bootGame();
    g.fake.race.start({ startAt: g.fake.clock.now() });
    g.fake.openOverlay('menu');
    expect(g.hook.paused()).toBe(false);
    g.press('pause');
    expect(document.querySelector('[data-testid="confirm"]')).not.toBeNull();
    g.press('confirm-yes');
    await g.settle();
    expect(g.fake.log.count('race.leave')).toBe(1);
    expect(g.hook.screen()).toBe('title');
  });

  it('the title has Race and Open races buttons', async () => {
    const g = await bootGame();
    g.press('race');
    g.press('race-browse');
    expect(g.fake.log.last('race.create')?.args[0]).toEqual({ params: { coins: 10 } });
    expect(g.fake.log.count('race.browse')).toBe(1);
  });
});
