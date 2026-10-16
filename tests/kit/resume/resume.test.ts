import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivity, type Json } from '../../../src/kit/core/index.ts';
import { createResume, type ResumeSpec } from '../../../src/kit/resume/index.ts';
import { createFakeHub, type FakeHub } from '../../../src/kit/testing/index.ts';

type R = { level: number };
const isR = (x: Json): x is R =>
  typeof x === 'object' && x !== null && !Array.isArray(x) && typeof x.level === 'number';
const spec: ResumeSpec<R> = {
  version: 3,
  validate: isR,
  progress: (r) => ({ label: `Level ${r.level}`, fraction: r.level / 10 }),
};

let fake: FakeHub;
const activity = createActivity();
const make = (over: Partial<ResumeSpec<R>> = {}) =>
  createResume(fake, { ...spec, ...over }, { activity, clock: fake.clock });

beforeEach(() => {
  fake = createFakeHub({ events: new EventTarget() });
  activity.set(null);
});

describe('resume: Continue', () => {
  it('saves with a kid-friendly label and loads it back (same version only)', async () => {
    const r = make();
    activity.set('normal');
    expect(r.save({ level: 4 })).toBe(true);
    expect(fake.resume.stored).toMatchObject({ progress: { label: 'Level 4', fraction: 0.4 }, version: 3 });
    expect(await make().load()).toEqual({ level: 4 });
    expect(await make({ version: 4 }).load()).toBeNull();
  });

  it('save is a no-op in a race or online, and in a daily with no day active', () => {
    const r = make();
    for (const mode of ['race', 'online', 'daily'] as const) {
      activity.set(mode);
      expect(r.save({ level: 1 })).toBe(false);
    }
    expect(fake.log.count('resume.save')).toBe(0);
  });

  it('in a daily, saves go to the day; clear starts the day over and keeps the saved game', async () => {
    fake.resume.stored = { state: { level: 9 }, progress: { label: 'Level 9' }, version: 3, savedAt: 0 };
    fake.daily.define({ play: () => undefined });
    await fake.daily.start();
    activity.set('daily');
    const r = make();
    expect(r.save({ level: 2 })).toBe(true);
    expect(fake.log.count('daily.save')).toBe(1);
    r.clear();
    expect(fake.log.count('resume.clear.daily')).toBe(1);
    expect(fake.resume.stored?.state).toEqual({ level: 9 });
  });

  it('a normal game is not saved while the hub has a day active (it would land in the day)', async () => {
    fake.daily.define({ play: () => undefined });
    await fake.daily.start();
    activity.set('normal');
    expect(make().save({ level: 2 })).toBe(false);
    expect(fake.log.count('daily.save')).toBe(0);
  });

  it('a stored state that fails validation reads as nothing', async () => {
    fake.resume.save({ state: { nope: true }, progress: { label: 'x' }, version: 3 });
    expect(await make().load()).toBeNull();
  });

  it('migrates an old getSave slot once, then deletes it (flux, quanta, tetrablox, 8ballpool)', async () => {
    fake.progress.seed('resume', { level: 6 });
    const r = make({ legacySlot: 'resume' });
    expect(await r.load()).toEqual({ level: 6 });
    expect(fake.resume.stored?.state).toEqual({ level: 6 });
    expect(fake.log.count('deleteSave')).toBe(1);
  });

  it('beforeNewGame waits for a slow lookup, and gives up after 8 s (garbage deal, tetrablox savedRun)', async () => {
    let release = (): void => undefined;
    fake.resume.loadDelay = new Promise((res) => (release = res));
    fake.resume.stored = { state: { level: 9 }, progress: { label: 'Level 9' }, version: 3, savedAt: 0 };
    const slow = make().beforeNewGame();
    release();
    expect(await slow).toEqual({ level: 9 });

    fake.resume.loadDelay = new Promise(() => undefined);
    const stuck = make().beforeNewGame();
    await fake.clock.settle();
    fake.clock.advance(8000);
    expect(await stuck).toBe('fresh');
  });

  it('offerLate fires only when the late saved game differs from the new one (solitaire offerLateRun)', async () => {
    let release = (): void => undefined;
    fake.resume.loadDelay = new Promise((res) => (release = res));
    fake.resume.stored = { state: { level: 5 }, progress: { label: 'Level 5' }, version: 3, savedAt: 0 };
    const onLate = vi.fn();
    make().offerLate(() => ({ level: 1 }), onLate);
    release();
    await fake.clock.settle();
    expect(onLate).toHaveBeenCalledWith({ level: 5 });

    const same = vi.fn();
    fake.resume.loadDelay = null;
    make().offerLate(() => ({ level: 5 }), same);
    await fake.clock.settle();
    expect(same).not.toHaveBeenCalled();
  });

  it('clear and flush reach the hub; requested mirrors ?hub_resume=1', () => {
    fake = createFakeHub({ events: new EventTarget(), resumeRequested: true });
    const r = make();
    expect(r.requested).toBe(true);
    r.clear();
    r.flush();
    expect(fake.log.names()).toEqual(expect.arrayContaining(['resume.clear', 'resume.flush']));
  });

  it('warns in dev about a label that says "run"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    activity.set('normal');
    make({ progress: () => ({ label: 'Your run, level 2' }) }).save({ level: 2 });
    expect(warn.mock.calls.flat().join(' ')).toMatch(/run/);
    warn.mockRestore();
  });
});
