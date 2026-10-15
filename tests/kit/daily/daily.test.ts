import { beforeEach, describe, expect, it } from 'vitest';
import { installDaily, type DailyOptions, type DailyStart } from '../../../src/kit/daily/index.ts';
import { seedForDay } from '../../../src/kit/rng/index.ts';
import { createFakeHub, type FakeHub } from '../../../src/kit/testing/index.ts';

let fake: FakeHub;
let played: DailyStart[];
let notes: string[];

function install(over: Partial<DailyOptions> = {}) {
  return installDaily(fake, {
    slug: 'mygame',
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
      { day: '2026-10-15', seed: seedForDay('mygame', '2026-10-15'), recorded: true, saved: null },
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

  it('leave cancels the day (so hub.resume.save works again)', async () => {
    const d = install();
    d.ready();
    await fake.daily.start();
    expect(fake.resume.blockedBy).toBe('daily');
    d.leave();
    expect(fake.log.count('daily.cancel')).toBe(1);
    expect(fake.resume.blockedBy).toBeNull();
    expect(d.current).toBeNull();
  });

  it('offline (hub:daily-error): plays the day unrecorded from the hub seed, and never completes it', async () => {
    fake.progress.offline = true;
    const d = install();
    d.ready();
    await fake.daily.start('2026-10-14');
    expect(notes).toEqual(['offline']);
    expect(played[0]).toMatchObject({ day: '2026-10-14', seed: seedForDay('mygame', '2026-10-14'), recorded: false });
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

  it('discard uses the planned hub.daily.discard when present, else cancel', async () => {
    const d = install();
    d.ready();
    await fake.daily.start();
    d.discard();
    expect(fake.log.count('daily.cancel')).toBe(1);
    fake = createFakeHub({ events: new EventTarget(), planned: { savedGames: true } });
    const d2 = install();
    d2.ready();
    await fake.daily.start();
    d2.discard();
    expect(fake.log.count('daily.discard')).toBe(1);
  });

  it('passes a planned challenge.saved through to the session', async () => {
    fake = createFakeHub({ events: new EventTarget(), planned: { savedGames: true } });
    fake.daily.savedFor.set('2026-10-15', { saved: { level: 3 } });
    const d = install();
    d.ready();
    await fake.daily.start('2026-10-15');
    expect(played[0]?.saved).toEqual({ level: 3 });
  });
});
