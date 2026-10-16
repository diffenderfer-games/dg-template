// Appendix B rows 18–21: Continue (hub.resume) and the page hiding.
import { expect, it } from 'vitest';
import { bootGame, describeIf, HAS, resultBoards, savedGame } from './_support/harness.ts';

describeIf(HAS.resume, 'this game is not resumable (game.resumable)')('Continue (hub.md "Resume saved games")', () => {
  it('row 18: ?hub_resume=1 goes straight back into the saved game', async () => {
    const saved = await savedGame(6);
    const g = await bootGame({
      fake: { resumeRequested: true },
      before: (f) => void f.resume.save(saved),
    });
    expect(g.hook.screen()).toBe('play');
    expect(g.hook.snap()).toMatchObject({ score: 6 });
    expect(g.calls.count('newRun')).toBe(0);
  });

  it('a saved game shows a Continue row on the title, with the label it was saved with (Your games)', async () => {
    const saved = { ...(await savedGame(6)), progress: { label: 'Level 3 · 48 s left' } };
    const g = await bootGame({ before: (f) => void f.resume.save(saved) });
    await g.frames(5);
    const row = g.ui.querySelector('[data-testid="continue"]');
    expect(row?.textContent).toMatch(/Level 3 · 48 s left/);
    g.press('continue');
    await g.settle();
    expect(g.hook.snap()).toMatchObject({ score: 6 });
  });

  it.skipIf(!HAS.daily)('row 19: in a race, a room or a daily, nothing is saved for Continue', async () => {
    const g = await bootGame();
    await g.fake.daily.start();
    await g.frames(2);
    expect(g.hook.mode()).toBe('daily');
    g.hook.pause?.();
    expect(g.fake.log.count('resume.save')).toBe(0);
  });

  it('row 20: a saved game found after a new game started is offered, not lost (late-load guard)', async () => {
    let release = (): void => undefined;
    const saved = await savedGame(6);
    const g = await bootGame({
      before: (f) => {
        f.resume.save(saved);
        f.resume.loadDelay = new Promise((r) => (release = r));
      },
    });
    await g.start();
    expect(g.fake.log.count('resume.clear')).toBe(0);
    release();
    await g.frames(2);
    expect(g.ui.querySelector('[data-testid="late-continue"]')).not.toBeNull();
    g.press('late-continue');
    expect(g.hook.snap()).toMatchObject({ score: 6 });
  });

  it('row 21: hiding the page pauses, saves for Continue and flushes', async () => {
    const g = await bootGame();
    await g.start();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect(g.hook.paused()).toBe(true);
    expect(g.fake.log.count('resume.save')).toBeGreaterThan(0);
    expect(g.fake.log.count('resume.flush')).toBeGreaterThan(0);
  });

  it('a finished normal game clears Continue and updates the profile (onResult)', async () => {
    const g = await bootGame();
    await g.start();
    g.hook.addScore?.(4);
    g.hook.loseNow?.();
    expect(g.fake.log.count('resume.clear')).toBeGreaterThan(0);
    expect(g.calls.named('onResult')).toHaveLength(1);
    // Every board the game's result() named got its number (the kit applies the normal-mode rules).
    const boards = resultBoards(g);
    const submitted = g.fake.log.named('submitScore').map((c) => c.args.slice(0, 2));
    for (const board of boards) expect(submitted).toContainEqual(board);
    expect(g.hook.screen()).toBe('result');
  });
});
