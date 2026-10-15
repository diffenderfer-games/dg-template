import { describe, expect, expectTypeOf, it } from 'vitest';
import type { HubLike } from '../../../src/kit/core/index.ts';
import { createFakeHub, fakeClock } from '../../../src/kit/testing/index.ts';

describe('FakeHub: behaves like the hub client (fidelity)', () => {
  it('is a HubLike', () => {
    expectTypeOf(createFakeHub()).toExtend<HubLike>();
  });

  it('overlay: nested hub UI makes one open/close pair (multiplayer.md §4)', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    let pauses = 0;
    let resumes = 0;
    fake.overlay.autoPause({ pause: () => pauses++, resume: () => resumes++, resumeOnClose: true });
    const closeMenu = fake.openOverlay('menu');
    const closeChat = fake.openOverlay('chat');
    closeChat();
    expect(fake.overlay.isOpen).toBe(true);
    closeMenu();
    expect([pauses, resumes]).toEqual([1, 1]);
    expect(fake.log.names().filter((n) => n.startsWith('overlay.') && n !== 'overlay.autoPause')).toEqual([
      'overlay.open',
      'overlay.close',
    ]);
  });

  it('overlay: autoPause registered while UI is open pauses at once; busy means canPause false', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    fake.openOverlay('menu');
    let pauses = 0;
    fake.overlay.autoPause({ pause: () => pauses++ });
    expect(pauses).toBe(1);
    const fake2 = createFakeHub({ events: new EventTarget() });
    fake2.overlay.autoPause({ pause: () => pauses++ });
    fake2.mp.setBusy(true);
    fake2.openOverlay('menu');
    expect(pauses).toBe(1);
  });

  it('overlay holds the play group and applies the last enable/disable on close', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    fake.input.enable('play');
    const close = fake.openOverlay();
    expect(fake.input.isEnabled('play')).toBe(false);
    fake.input.disable('play');
    close();
    expect(fake.input.isEnabled('play')).toBe(false);
  });

  it('mp: a launch before onLaunch is buffered and delivered on register', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    fake.mp.launch({ kind: 'join', room: 'ABCDE' });
    const got: string[] = [];
    fake.mp.onLaunch((l) => got.push(l.kind));
    expect(got).toEqual(['join']);
  });

  it('resume.save returns false in a race, a room or a daily (hub.md "Resume")', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    const run = { state: { a: 1 }, progress: { label: 'Level 1' } };
    expect(fake.resume.save(run)).toBe(true);
    fake.race.define({ start: () => undefined });
    fake.race.start();
    expect(fake.resume.save(run)).toBe(false);
    expect(fake.resume.blockedBy).toBe('race');
    fake.race.exit();
    await fake.rooms.create();
    expect(fake.resume.blockedBy).toBe('room');
  });

  it('getSave offline rejects with save_unknown for an unseen slot, never save: null', async () => {
    const fake = createFakeHub({ offline: true, events: new EventTarget() });
    await expect(fake.getSave('main')).rejects.toMatchObject({ code: 'save_unknown' });
    fake.progress.seed('main', { level: 3 });
    await expect(fake.getSave('main')).resolves.toMatchObject({ save: { data: { level: 3 } } });
  });

  it('daily: a start before define waits for define, uses the hub seed, and complete ends it once', async () => {
    const clock = fakeClock(Date.UTC(2026, 9, 15));
    const fake = createFakeHub({ clock, events: new EventTarget() });
    void fake.daily.start();
    const seeds: number[] = [];
    fake.daily.define({ play: (c) => seeds.push(c.seed) });
    await clock.settle();
    expect(seeds).toEqual([1106517459]);
    expect(fake.daily.active?.day).toBe('2026-10-15');
    await fake.daily.complete({ score: 3 });
    expect(fake.daily.active).toBeNull();
    expect(await fake.daily.complete({ score: 3 })).toBeNull();
  });

  it('planned APIs are absent unless asked for (like the published client)', () => {
    const plain = createFakeHub({ events: new EventTarget() });
    expect(plain.saved).toBeUndefined();
    expect(plain.daily.save).toBeUndefined();
    expect(plain.mp.quickMatch).toBeUndefined();
    const planned = createFakeHub({
      events: new EventTarget(),
      planned: { savedGames: true, world: true, avatars: true, turns: true },
    });
    expect(planned.saved).toBeDefined();
    expect(planned.daily.save).toBeTypeOf('function');
    expect(planned.mp.setRoster).toBeTypeOf('function');
    expect(planned.avatar).toBeDefined();
    expect(planned.turns).toBeDefined();
  });

  it('fake clock runs due timers in order and only when advanced', () => {
    const clock = fakeClock(0);
    const order: string[] = [];
    clock.after(20, () => order.push('b'));
    clock.after(10, () => order.push('a'));
    clock.advance(15);
    expect(order).toEqual(['a']);
    clock.advance(5);
    expect(order).toEqual(['a', 'b']);
    expect(clock.now()).toBe(20);
  });
});
