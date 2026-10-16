// Appendix B rows 29–33: races (multiplayer.md §14).
import { expect, it } from 'vitest';
import { bootGame, describeIf, HAS, PROBE, RACE_PARAM } from './_support/harness.ts';

/** The game's first race param, as the race creator picked it (or none). */
const params = RACE_PARAM === null ? {} : { [RACE_PARAM.key]: RACE_PARAM.value };

describeIf(HAS.race, 'this game declares no game.race')('races (multiplayer.md §14)', () => {
  it('row 29: start builds from seed + params only; resumed restores the stash; spectators get nothing', async () => {
    const g = await bootGame();
    g.fake.race.start({ seed: 77, params, startAt: g.fake.clock.now() });
    expect(g.hook.mode()).toBe('race');
    expect(g.calls.last('newRun')?.args[0]).toMatchObject({ mode: 'race', seed: 77 });
    g.hook.addScore?.(2);
    await g.frames(30); // reports (and stashes) the game
    g.fake.race.start({ seed: 77, params, startAt: g.fake.clock.now(), resumed: true });
    expect(g.hook.snap()).toMatchObject({ score: 2 });

    const s = await bootGame();
    s.fake.race.start({ spectator: true });
    expect(s.hook.mode()).toBeNull();
  });

  it('row 30: the game waits for the go (startAt): no steps before it', async () => {
    const g = await bootGame();
    g.fake.race.start({ params, startAt: g.fake.clock.now() + 3000 });
    await g.frames(60);
    expect(g.calls.count('step')).toBe(0);
    await g.frames(160);
    expect(g.calls.count('step')).toBeGreaterThan(0);
  });

  it('row 31: end locks input; exit goes back to the title; races write no stats and no boards', async () => {
    const g = await bootGame();
    g.fake.race.start({ params, startAt: g.fake.clock.now() });
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
    g.fake.race.start({ params, startAt: g.fake.clock.now() });
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
    g.fake.race.start({ params, startAt: g.fake.clock.now() });
    g.fake.race.hud({ top: 48 });
    expect(getComputedStyle(document.documentElement).getPropertyValue('--hub-race-hud-top')).toBe('48px');
  });

  it('a race is never paused: the pause button asks "Leave race?"', async () => {
    const g = await bootGame();
    g.fake.race.start({ params, startAt: g.fake.clock.now() });
    g.fake.openOverlay('menu');
    expect(g.hook.paused()).toBe(false);
    g.press('pause');
    expect(document.querySelector('[data-testid="confirm"]')).not.toBeNull();
    g.press('confirm-yes');
    await g.settle();
    expect(g.fake.log.count('race.leave')).toBe(1);
    expect(g.hook.screen()).toBe('title');
  });

  it('pausing again while "Leave race?" asks (Esc, Start) answers Stay', async () => {
    const g = await bootGame();
    g.fake.race.start({ params, startAt: g.fake.clock.now() });
    g.press('pause');
    expect(document.querySelector('[data-testid="confirm"]')).not.toBeNull();
    g.press('pause');
    await g.settle();
    expect(document.querySelector('[data-testid="confirm"]')).toBeNull();
    expect(g.fake.log.count('race.leave')).toBe(0);
    expect(g.hook.screen()).toBe('play');
  });

  it('the title has Race and Open races buttons; Race creates one with the game’s params', async () => {
    const g = await bootGame();
    g.press('race');
    g.press('race-browse');
    const own = PROBE.race?.params?.();
    if (own !== undefined) expect(g.fake.log.last('race.create')?.args[0]).toEqual({ params: own });
    else expect(g.fake.log.count('race.create')).toBe(1);
    expect(g.fake.log.count('race.browse')).toBe(1);
  });
});
