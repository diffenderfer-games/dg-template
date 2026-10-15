import { beforeEach, describe, expect, it } from 'vitest';
import { createActivity, createStore, type Json, type Store } from '../../../src/kit/core/index.ts';
import { createProfile, maxOf, unionOf, type ProfileSpec } from '../../../src/kit/save/index.ts';
import { createFakeHub, fakeStorage, type FakeHub } from '../../../src/kit/testing/index.ts';

type P = { best: number; levels: string[] };

const isP = (x: Json): x is P =>
  typeof x === 'object' && x !== null && !Array.isArray(x) && typeof x.best === 'number' && Array.isArray(x.levels);

const spec: ProfileSpec<P> = {
  version: 2,
  defaults: () => ({ best: 0, levels: [] }),
  merge: (cloud, local) => ({ best: maxOf(cloud.best, local.best), levels: unionOf(cloud.levels, local.levels) }),
  validate: isP,
  migrate: (old, from) =>
    from === 1 && typeof old === 'object' && old !== null && !Array.isArray(old) && typeof old.score === 'number'
      ? { best: old.score, levels: [] }
      : null,
};

let fake: FakeHub;
let store: Store;
const activity = createActivity();

function make(over: Partial<ProfileSpec<P>> = {}) {
  return createProfile(
    fake,
    { ...spec, ...over },
    { slug: 'mygame', clock: fake.clock, activity, store, events: fake.events },
  );
}

/** Let the profile's promises and debounced push run. */
async function settle(ms = 1100): Promise<void> {
  await fake.clock.settle();
  fake.clock.advance(ms);
  await fake.clock.settle();
}

const pushes = () => fake.log.named('putSave');

beforeEach(() => {
  fake = createFakeHub({ events: new EventTarget() });
  const kv = fakeStorage();
  store = createStore(() => kv);
  activity.set(null);
});

describe('profile: the save guards', () => {
  it('is usable at once with defaults (fresh objects every call)', () => {
    const p = make();
    expect(p.data).toEqual({ best: 0, levels: [] });
    expect(spec.defaults()).not.toBe(spec.defaults());
  });

  it('guard 1: never pushes before the cloud read answers (downfall / GD push-before-read)', async () => {
    let release = (): void => undefined;
    fake.progress.readDelay = new Promise((r) => (release = r));
    fake.progress.seed('main', { v: 2, data: { best: 50, levels: ['a'] } });
    const p = make();
    p.update((d) => (d.best = 5));
    await settle(5000);
    expect(pushes()).toHaveLength(0);
    release();
    fake.progress.readDelay = null;
    await settle();
    expect(p.data.best).toBe(50);
  });

  it('guard 2: an offline save_unknown read is "unknown", not "empty": nothing is pushed (hub.md "Saves offline")', async () => {
    fake.progress.offline = true;
    const p = make();
    await p.ready();
    expect(p.state).toBe('unknown');
    p.update((d) => (d.best = 3));
    await settle(5000);
    expect(pushes()).toHaveLength(0);
  });

  it('guard 2: a failed read stays unknown until a later read succeeds, then merges', async () => {
    fake.progress.failReads = 1;
    fake.progress.seed('main', { v: 2, data: { best: 40, levels: ['x'] } });
    const p = make();
    await p.ready();
    expect(p.state).toBe('unknown');
    p.update((d) => d.levels.push('y'));
    fake.goOnline();
    await settle();
    expect(p.state).toBe('ready');
    expect(p.data).toEqual({ best: 40, levels: ['x', 'y'] });
  });

  it('guard 2: signed out (401) means nothing to protect: plays locally (solitaire, uno)', async () => {
    fake.progress.failReads = 0;
    const getSave = fake.getSave;
    fake.getSave = () => Promise.reject(Object.assign(new Error('auth'), { status: 401 }));
    const p = make();
    await p.ready();
    expect(p.state).toBe('ready');
    fake.getSave = getSave;
  });

  it('guard 3: progress earned during a slow load is merged, not lost (uno, garbage)', async () => {
    let release = (): void => undefined;
    fake.progress.readDelay = new Promise((r) => (release = r));
    fake.progress.seed('main', { v: 2, data: { best: 10, levels: ['a'] } });
    const p = make();
    p.update((d) => d.levels.push('b'));
    release();
    fake.progress.readDelay = null;
    await settle();
    expect(p.data).toEqual({ best: 10, levels: ['a', 'b'] });
    const last = pushes().at(-1)?.args[1];
    expect(last).toEqual({ v: 2, data: { best: 10, levels: ['a', 'b'] } });
  });

  it('guard 4: a push re-reads and merges onto the latest copy (another device saved meanwhile; 8ballpool stats.ts)', async () => {
    const p = make();
    await p.ready();
    fake.progress.seed('main', { v: 2, data: { best: 99, levels: ['other-device'] } });
    p.update((d) => d.levels.push('mine'));
    await settle();
    expect(pushes().at(-1)?.args[1]).toEqual({ v: 2, data: { best: 99, levels: ['other-device', 'mine'] } });
    expect(p.data.best).toBe(99);
  });

  it('guard 4: never writes over a copy saved by a newer version of the game', async () => {
    fake.progress.seed('main', { v: 3, data: { something: 'new' } });
    const p = make();
    await p.ready();
    p.update((d) => (d.best = 1));
    await settle();
    expect(pushes()).toHaveLength(0);
  });

  it('guard 4: debounce coalesces many changes into one push', async () => {
    const p = make();
    await p.ready();
    for (let i = 1; i <= 5; i++) p.update((d) => (d.best = i));
    await settle();
    expect(pushes()).toHaveLength(1);
  });

  it('guard 5: switching accounts cancels the pending push and never leaks progress (SpaceClicker, skipbo)', async () => {
    const p = make();
    await p.ready();
    p.update((d) => (d.best = 77));
    fake.auth({ id: 2, username: 'B', guest: false });
    await settle();
    expect(p.data.best).toBe(0);
    expect(fake.progress.saves.get(2)?.get('main')).toBeUndefined();
    expect(pushes()).toHaveLength(0);
  });

  it("guard 5: a guest's progress carries into the account they log in to", async () => {
    fake = createFakeHub({ user: { id: 5, username: 'Guest5', guest: true }, events: new EventTarget() });
    const p = make();
    await p.ready();
    p.update((d) => d.levels.push('guest-level'));
    fake.progress.seed('main', { v: 2, data: { best: 12, levels: ['acct'] } }, 6);
    fake.auth({ id: 6, username: 'Sam', guest: false });
    await settle();
    expect(p.data).toEqual({ best: 12, levels: ['acct', 'guest-level'] });
  });

  it('guard 6: legacy local keys fold in once, keeping a ::folded backup (SpaceClicker foldSave)', async () => {
    store.setJson('old-best', 31);
    const fold = (old: Json, into: P): P => ({ ...into, best: Math.max(into.best, typeof old === 'number' ? old : 0) });
    const p = make({ legacy: { keys: ['old-best'], fold } });
    await p.ready();
    expect(p.data.best).toBe(31);
    expect(store.getJson('old-best')).toBeUndefined();
    expect(store.getText('old-best::folded')).toBe('31');
  });

  it('guard 7: hub:reset wipes the local copies (tetrablox, dumplings)', async () => {
    const p = make();
    await p.ready();
    p.update((d) => (d.best = 8));
    expect(store.keys('mygame:')).not.toHaveLength(0);
    fake.reset();
    expect(store.keys('mygame:')).toHaveLength(0);
    expect(p.data.best).toBe(0);
  });

  it('guard 8: a daily never writes the profile (dinodasher, helixdrop, bubblepop regressions)', async () => {
    const p = make();
    await p.ready();
    activity.set('daily');
    expect(() => p.update((d) => (d.best = 1000))).toThrow(/daily/);
    expect(p.data.best).toBe(0);
    p.update((d) => d.levels.push('daily-attempt-book'), { allowInDaily: true });
    expect(p.data.levels).toEqual(['daily-attempt-book']);
    activity.set('race');
    expect(() => p.update((d) => (d.best = 5))).toThrow(/race/);
  });

  it('migrates v1 to v2 and ignores an invalid cloud blob (not adopted)', async () => {
    fake.progress.seed('main', { v: 1, data: { score: 17 } });
    const p = make();
    await p.ready();
    expect(p.data.best).toBe(17);
    const fake2 = createFakeHub({ events: new EventTarget() });
    fake2.progress.seed('main', { v: 2, data: { best: 'lots' } });
    const p2 = createProfile(fake2, spec, { slug: 'g', clock: fake2.clock, activity, store, events: fake2.events });
    await p2.ready();
    expect(p2.data.best).toBe(0);
  });

  it('keeps an owner-tagged local copy: another account never reads it (bingo PREFS_OWNER_KEY)', async () => {
    const p = make();
    await p.ready();
    p.update((d) => (d.best = 4));
    expect(store.getJson('mygame:profile::u1')).toMatchObject({ owner: 1 });
    expect(store.getJson('mygame:profile::u2')).toBeUndefined();
  });

  it('flush pushes now (page hidden)', async () => {
    const p = make();
    await p.ready();
    p.update((d) => (d.best = 2));
    await p.flush();
    expect(pushes()).toHaveLength(1);
  });
});
