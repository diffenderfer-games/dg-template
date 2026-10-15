import { describe, expect, it } from 'vitest';
import { recordResult, type ScoreSpec } from '../../../src/kit/scores/index.ts';
import { createFakeHub } from '../../../src/kit/testing/index.ts';

const spec: ScoreSpec = {
  boards: {
    high: { title: 'High score' },
    fastest: { title: 'Fastest', sort: 'asc' },
    'daily-score': { title: 'Daily' },
    wins: { title: 'Online wins' },
  },
  dailyBoard: 'daily-score',
  onlineBoards: ['wins'],
};
const all = { boards: { high: 10, fastest: 30, 'daily-score': 5, wins: 1 }, incr: { played: 1 }, max: { combo: 4 } };

describe('scores: who may write boards and stats', () => {
  it('a normal game submits to its boards and stats', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    expect(recordResult(fake, spec, { mode: 'normal', ...all })).toEqual(['high', 'fastest', 'daily-score', 'wins']);
    expect(fake.log.named('submitScore').map((c) => c.args[0])).toEqual(['high', 'fastest', 'daily-score', 'wins']);
    expect(fake.log.last('submitScore')?.args[2]).toEqual({ title: 'Online wins' });
    expect(fake.log.named('submitScore')[1]?.args[2]).toEqual({ title: 'Fastest', sort: 'asc' });
    expect(fake.log.count('incrStat') + fake.log.count('maxStat')).toBe(2);
  });

  it('a daily submits only to the daily board, and no stats (the arrow-escape win() rule)', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    expect(recordResult(fake, spec, { mode: 'daily', ...all })).toEqual(['daily-score']);
    expect(fake.log.count('incrStat')).toBe(0);
  });

  it('a race writes nothing (the hub keeps race history)', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    expect(recordResult(fake, spec, { mode: 'race', ...all })).toEqual([]);
    expect(fake.log.calls).toHaveLength(0);
  });

  it('online play reaches only the online boards, plus its own stats', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    expect(recordResult(fake, spec, { mode: 'online', ...all })).toEqual(['wins']);
    expect(fake.log.count('incrStat')).toBe(1);
  });

  it('an undeclared board is a rule break (kit:check catches it before)', () => {
    const fake = createFakeHub({ events: new EventTarget() });
    expect(() => recordResult(fake, spec, { mode: 'normal', boards: { secret: 1 } })).toThrow(/declared/);
  });

  it('a hub error never reaches the game (fire and forget)', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    fake.submitScore = () => Promise.reject(new Error('offline'));
    expect(() => recordResult(fake, spec, { mode: 'normal', boards: { high: 1 } })).not.toThrow();
    await fake.clock.settle();
  });
});
