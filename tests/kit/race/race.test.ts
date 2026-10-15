import { describe, expect, it } from 'vitest';
import { createStore, type Json } from '../../../src/kit/core/index.ts';
import { checkStats, installRace, RACE_STATUS_MS } from '../../../src/kit/race/index.ts';
import { createFakeHub, fakeStorage } from '../../../src/kit/testing/index.ts';

const isRun = (x: Json): x is { n: number } =>
  typeof x === 'object' && x !== null && !Array.isArray(x) && typeof x.n === 'number';

function setup() {
  const fake = createFakeHub({ events: new EventTarget() });
  const kv = fakeStorage();
  const started: { seed: number; restored: Json | null }[] = [];
  const events: string[] = [];
  const race = installRace(fake, {
    slug: 'g',
    clock: fake.clock,
    stash: createStore(() => kv),
    isRun,
    onStart: (r, restored) => started.push({ seed: r.seed, restored }),
    onEnd: () => events.push('end'),
    onExit: () => events.push('exit'),
    notify: (t) => events.push(`notify:${t}`),
  });
  return { fake, race, started, events };
}

describe('race adapter', () => {
  it('stats are numbers, booleans or #rrggbb, never text (bad_stats), at most 12', () => {
    expect(checkStats({ moves: 3, done: true, color: '#ff0000' })).toBeTruthy();
    expect(() => checkStats({ name: 'Sam' })).toThrow(/text/);
    const many: Record<string, number> = {};
    for (let i = 0; i < 13; i++) many[`k${i}`] = i;
    expect(() => checkStats(many)).toThrow(/12/);
  });

  it('locks input until the go and after the end; finish is sent once', () => {
    const { fake, race } = setup();
    fake.race.start({ startAt: fake.clock.now() + 1000 });
    expect(race.locked()).toBe(true);
    fake.clock.advance(1000);
    expect(race.locked()).toBe(false);
    race.finish({ n: 1 });
    race.finish({ n: 1 });
    race.lose({ n: 1 });
    expect(fake.log.count('race.finish') + fake.log.count('race.lose')).toBe(1);
    expect(race.locked()).toBe(true);
  });

  it('throttles status and stashes the game for a reload (arrow-escape raceSave)', () => {
    const { fake, race, started } = setup();
    fake.race.start({ roomId: 'r1', round: 2, startAt: 0 });
    for (let i = 0; i < 10; i++) {
      race.report({ n: i }, { n: i });
      fake.clock.advance(RACE_STATUS_MS / 2);
    }
    expect(fake.log.count('race.status')).toBe(5);
    fake.race.start({ roomId: 'r1', round: 2, startAt: 0, resumed: true });
    expect(started.at(-1)?.restored).toEqual({ n: 8 });
  });

  it('a failed create tells the player in kid words', async () => {
    const { fake, race, events } = setup();
    fake.race.create = () => Promise.reject(Object.assign(new Error('x'), { code: 'offline' }));
    race.create();
    await fake.clock.settle();
    expect(events).toEqual(['notify:Online play needs a connection.']);
  });
});
