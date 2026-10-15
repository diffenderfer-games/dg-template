// Appendix B rows 18–21: Continue (hub.resume) and the page hiding.
import { describe, expect, it } from 'vitest';
import { bootGame } from './_support/harness.ts';

const savedRun = {
  mode: 'normal',
  seed: 9,
  rng: 9,
  t: 12,
  timeLimit: 60,
  target: 0,
  player: { x: 100, y: 100 },
  coin: { x: 500, y: 500 },
  score: 6,
  over: null,
} as const;

describe('Continue (hub.md "Resume saved games")', () => {
  it('row 18: ?hub_resume=1 goes straight back into the saved game', async () => {
    const g = await bootGame({
      fake: { resumeRequested: true },
      before: (f) => void f.resume.save({ state: savedRun, progress: { label: '6 coins' }, version: 1 }),
    });
    expect(g.hook.screen()).toBe('play');
    expect(g.hook.snap()).toMatchObject({ score: 6 });
    expect(g.calls.count('newRun')).toBe(0);
  });

  it('a saved game shows a Continue row on the title, with its label', async () => {
    const g = await bootGame({
      before: (f) => void f.resume.save({ state: savedRun, progress: { label: 'x' }, version: 1 }),
    });
    await g.frames(5);
    const row = g.ui.querySelector('[data-testid="continue"]');
    expect(row?.textContent).toMatch(/6 coins · 48 s left/);
    g.press('continue');
    await g.settle();
    expect(g.hook.snap()).toMatchObject({ score: 6 });
  });

  it('row 19: in a race, a room or a daily, nothing is saved for Continue', async () => {
    const g = await bootGame();
    await g.fake.daily.start();
    await g.frames(2);
    expect(g.hook.mode()).toBe('daily');
    g.hook.pause?.();
    expect(g.fake.log.count('resume.save')).toBe(0);
  });

  it('row 20: a saved game found after a new game started is offered, not lost (late-load guard)', async () => {
    let release = (): void => undefined;
    const g = await bootGame({
      before: (f) => {
        f.resume.save({ state: savedRun, progress: { label: 'x' }, version: 1 });
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
    g.hook.extra?.addCoins?.(4);
    g.hook.loseNow?.();
    expect(g.fake.log.count('resume.clear')).toBeGreaterThan(0);
    expect(g.calls.named('onResult')).toHaveLength(1);
    expect(g.fake.log.last('submitScore')?.args.slice(0, 2)).toEqual(['high', 4]);
    expect(g.hook.screen()).toBe('result');
  });
});
