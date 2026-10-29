import { beforeEach, describe, expect, it } from 'vitest';
import { installDaily, type DailyOptions, type DailyStart } from '../../../src/kit/daily/index.ts';
import { seedForDay } from '../../../src/kit/rng/index.ts';
import { createFakeHub, type FakeHub } from '../../../src/kit/testing/index.ts';

let fake: FakeHub;
let played: DailyStart[];
let notes: string[];

function install(over: Partial<DailyOptions> = {}) {
  return installDaily(fake, {
    slug: fake.slug,
    clock: fake.clock,
    events: fake.events,
    onPlay: (s) => played.push(s),
    notify: (k) => notes.push(k),
    onDeepLinkTimeout: () => notes.push('timeout'),
    search: '',
    ...over,
  });
}

beforeEach(() => {
  fake = createFakeHub({ events: new EventTarget() });
  played = [];
  notes = [];
});

describe('daily adapter', () => {
  it('registers define synchronously at install', () => {
    install();
    expect(fake.log.names()).toContain('daily.define');
  });

  it('a day that starts before mount is queued, then played once on ready (quanta boardMade)', async () => {
    const d = install();
    await fake.daily.start('2026-10-15');
    expect(played).toHaveLength(0);
    d.ready();
    d.ready();
    expect(played).toEqual([
      { day: '2026-10-15', seed: seedForDay(fake.slug, '2026-10-15'), recorded: true, saved: null },
    ]);
  });

  it('complete records once, only while active (daily-puzzle completeDaily)', async () => {
    const d = install();
    d.ready();
    await fake.daily.start();
    expect(d.complete({ score: 3 })).toBe(true);
    expect(d.complete({ score: 3 })).toBe(false);
    expect(fake.log.count('daily.complete')).toBe(1);
    expect(install().complete({})).toBe(false);
  });

  it('leave pauses the day, so hub.resume.save goes to the saved game again (not to the day)', async () => {
    const d = install();
    d.ready();
    await fake.daily.start();
    fake.resume.save({ state: { level: 1 }, progress: { label: 'Level 1' } });
    expect(fake.log.count('resume.save.daily')).toBe(1);
    d.leave();
    expect(fake.log.count('daily.cancel')).toBe(1);
    fake.resume.save({ state: { level: 1 }, progress: { label: 'Level 1' } });
    expect(fake.log.count('resume.save')).toBe(1);
    expect(d.current).toBeNull();
  });

  it('offline (hub:daily-error): plays the day unrecorded from the hub seed, and never completes it', async () => {
    fake.progress.offline = true;
    const d = install();
    d.ready();
    await fake.daily.start('2026-10-14');
    expect(notes).toEqual(['offline']);
    expect(played[0]).toMatchObject({ day: '2026-10-14', seed: seedForDay(fake.slug, '2026-10-14'), recorded: false });
    expect(d.complete({})).toBe(false);
    expect(fake.log.count('daily.complete')).toBe(0);
  });

  it("offline with offline: 'toast' only tells the player", async () => {
    fake.progress.offline = true;
    const d = install({ offline: 'toast' });
    d.ready();
    await fake.daily.start();
    expect(played).toHaveLength(0);
    expect(notes).toEqual(['offline']);
  });

  it('a queued completion (offline) tells the player it will count later', async () => {
    const d = install();
    d.ready();
    await fake.daily.start();
    fake.progress.offline = true;
    d.complete({});
    await fake.clock.settle();
    expect(notes).toEqual(['queued']);
  });

  it('?daily= with no answer within 8 s goes to the title (popfour, bubblepop, helixdrop)', async () => {
    install({ search: '?daily=2026-10-15' });
    fake.clock.advance(7999);
    expect(notes).toEqual([]);
    fake.clock.advance(1);
    expect(notes).toEqual(['timeout']);
    const answered = install({ search: '?daily=2026-10-15' });
    answered.ready();
    await fake.daily.start();
    fake.clock.advance(8000);
    expect(notes).toEqual(['timeout']);
  });

  it('the same seed builds the same day (determinism is the game rules; the seed is the hub one)', async () => {
    const d = install();
    d.ready();
    await fake.daily.start('2026-01-01');
    await fake.daily.start('2026-01-01');
    expect(played[0]?.seed).toBe(played[1]?.seed);
  });

  it('leave pauses the day (it stays in progress); discard gives it up', async () => {
    const d = install();
    d.ready();
    await fake.daily.start('2026-10-15');
    d.leave();
    expect(fake.log.count('daily.cancel')).toBe(1);
    expect((await fake.daily.status()).inProgress).toEqual(['2026-10-15']);
    await fake.daily.start('2026-10-15');
    d.discard();
    await Promise.resolve();
    expect(fake.log.count('daily.discard')).toBe(1);
    expect((await fake.daily.status()).inProgress).toEqual([]);
  });

  it('passes challenge.saved through to the session (a day in progress)', async () => {
    fake.daily.inProgressDay('2026-10-15', { level: 3 });
    const d = install();
    d.ready();
    await fake.daily.start('2026-10-15');
    expect(played[0]?.saved).toEqual({ level: 3 });
  });

  it('resume(id) picks a day in progress up by its saved game', async () => {
    const id = fake.daily.inProgressDay('2026-10-02', { level: 5 });
    const d = install();
    d.ready();
    await fake.daily.resume(id);
    expect(played[0]).toMatchObject({ day: '2026-10-02', saved: { level: 5 }, recorded: true });
  });
});
