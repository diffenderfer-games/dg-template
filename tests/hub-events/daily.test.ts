// Appendix B rows 22–28: daily challenges.
import { describe, expect, it } from 'vitest';
import { seedForDay } from '../../src/kit/rng/index.ts';
import { bootGame } from './_support/harness.ts';
import { planned } from './_support/planned.ts';

describe('daily challenges (hub.md "Daily challenges")', () => {
  it('row 22: a day started before mount is played once, from the hub seed', async () => {
    const g = await bootGame({ before: (f) => void f.daily.start('2026-10-15') });
    expect(g.hook.mode()).toBe('daily');
    expect(g.calls.named('newRun')).toEqual([
      { name: 'newRun', args: [{ mode: 'daily', seed: seedForDay('mygame', '2026-10-15'), day: '2026-10-15' }] },
    ]);
  });

  it('row 23: a daily during a normal game saves the normal game to Continue first', async () => {
    const g = await bootGame();
    await g.start();
    const closeMenu = g.fake.openOverlay('menu'); // the daily is picked in the hub menu: the game pauses and saves
    await g.fake.daily.start();
    closeMenu();
    expect(g.fake.log.count('resume.save')).toBe(1);
    expect(g.hook.mode()).toBe('daily');
  });

  it('row 24: a win completes the day once, with meta; offline it is queued and the player is told', async () => {
    const g = await bootGame();
    await g.fake.daily.start();
    g.hook.solveNow?.();
    await g.frames(3);
    expect(g.fake.log.named('daily.complete')).toHaveLength(1);
    expect(g.fake.log.last('daily.complete')?.args[0]).toHaveProperty('coins');
    expect(g.hook.screen()).toBe('result');

    const off = await bootGame();
    await off.fake.daily.start();
    off.fake.progress.offline = true;
    off.hook.solveNow?.();
    await off.frames(3);
    expect(off.ui.querySelector('[data-testid="toast"]')?.textContent).toMatch(/when you are back online/);
  });

  it('row 25: hub:daily-error (offline) plays the day unrecorded, never completing it', async () => {
    const g = await bootGame({ fake: { offline: true } });
    await g.fake.daily.start('2026-10-14');
    await g.settle();
    expect(g.hook.mode()).toBe('daily');
    g.hook.solveNow?.();
    await g.frames(3);
    expect(g.fake.log.count('daily.complete')).toBe(0);
  });

  it('row 26: every way out of a daily that isn’t a win cancels it (title, new game), so Continue works again', async () => {
    const g = await bootGame();
    await g.fake.daily.start();
    g.hook.toTitle?.();
    expect(g.fake.log.count('daily.cancel')).toBe(1);
    expect(g.fake.resume.blockedBy).toBeNull();
    await g.fake.daily.start();
    await g.start();
    expect(g.fake.log.count('daily.cancel')).toBe(2);
    expect(g.hook.mode()).toBe('normal');
  });

  it('row 27: during a daily there is no profile write, no normal board and no Continue save (dinodasher, helixdrop, bubblepop)', async () => {
    const g = await bootGame();
    await g.fake.daily.start();
    g.hook.extra?.addCoins?.(50);
    g.hook.loseNow?.();
    await g.frames(100);
    expect(g.fake.log.count('putSave')).toBe(0);
    expect(g.fake.log.count('submitScore')).toBe(0);
    expect(g.fake.log.count('resume.save')).toBe(0);
    expect(g.calls.count('onResult')).toBe(0);
  });

  it('a lost day can be tried again from the same seed', async () => {
    const g = await bootGame();
    await g.fake.daily.start('2026-10-15');
    g.hook.loseNow?.();
    g.press('play-again');
    const runs = g.calls.named('newRun').map((c) => c.args[0]);
    expect(runs[1]).toEqual(runs[0]);
    expect(g.fake.daily.active).not.toBeNull();
  });

  it('?daily= with no answer within 8 s shows the title', async () => {
    const g = await bootGame({ search: '?daily=2026-10-15' });
    expect(g.hook.screen()).toBe('loading');
    await g.frames(520);
    expect(g.hook.screen()).toBe('title');
  });

  planned('savedGames01')(
    'row 28: a day in progress (challenge.saved) restores, and leaving pauses the day',
    async () => {
      const g = await bootGame();
      g.fake.daily.inProgressDay(
        '2026-10-15',
        {
          mode: 'daily',
          seed: 1,
          rng: 1,
          t: 3,
          timeLimit: 45,
          target: 6,
          player: { x: 1, y: 1 },
          coin: { x: 9, y: 9 },
          score: 2,
          over: null,
        },
        1,
      );
      await g.fake.daily.start('2026-10-15');
      expect(g.hook.snap()).toMatchObject({ score: 2 });
      expect(g.calls.count('newRun')).toBe(0);
      g.hook.pause?.();
      expect(g.fake.log.count('daily.save')).toBeGreaterThan(0);
      g.hook.toTitle?.();
      await g.settle();
      expect(g.fake.log.count('daily.cancel')).toBeGreaterThan(0);
      expect((await g.fake.daily.status()).inProgress).toEqual(['2026-10-15']);
      expect(g.ui.querySelector('[data-testid="continue"]')?.textContent).toMatch(/Daily challenge · Oct 15/);
    },
  );

  planned('savedGames01')('a lost day starts over from its seed, and stays in progress', async () => {
    const g = await bootGame();
    await g.fake.daily.start('2026-10-15');
    await g.frames(2);
    g.hook.loseNow?.();
    expect(g.fake.log.count('resume.clear.daily')).toBe(1);
    expect(g.fake.log.count('daily.complete')).toBe(0);
    expect((await g.fake.daily.status()).inProgress).toEqual(['2026-10-15']);
  });

  planned('savedGames01')('a normal game is never saved into a day the hub just started', async () => {
    const g = await bootGame();
    g.hook.newGame?.();
    await g.frames(2);
    await g.fake.daily.start('2026-10-15');
    expect(g.hook.mode()).toBe('daily');
    expect(g.fake.log.named('resume.save.daily')).toEqual([]);
  });

  it('the Daily button says "Done today" once today is done (hub.daily.status)', async () => {
    const g = await bootGame();
    await g.settle();
    expect(g.ui.querySelector('[data-testid="daily"]')?.textContent).not.toMatch(/Done today/);
    await g.fake.daily.start();
    g.hook.solveNow?.();
    await g.frames(3);
    g.hook.toTitle?.();
    await g.settle();
    expect(g.ui.querySelector('[data-testid="daily"]')?.textContent).toMatch(/Done today/);
  });
});
