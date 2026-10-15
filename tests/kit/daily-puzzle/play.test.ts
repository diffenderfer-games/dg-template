import { describe, expect, it } from 'vitest';
import {
  betterRecord, cancelDaily, checkVersions, completeDaily, inDaily, mergeBooks, pruneBook, PuzzleRun, recordFail,
  recordWin, replayLine, starsFor, verifyDailyLine, versionFor, versionNumbered, winMeta,
  type DailyHub, type GenVersion, type JsonObject,
} from '../../../src/kit/daily-puzzle/index.ts';
import { coinRules, coinSearch, startOf, type Coins } from './toy.ts';

describe('stars and records', () => {
  it('starsFor: 3 / 2 / 1', () => {
    expect([1, 2, 3, 9].map(starsFor)).toEqual([3, 2, 1, 1]);
  });

  it('a fail counts until the day is solved; a win sets the stars once', () => {
    let r = recordFail(undefined);
    r = recordFail(r);
    expect(r).toEqual({ attempts: 2 });
    const w = recordWin(r);
    expect(w).toEqual({ record: { attempts: 3, stars: 1 }, stars: 1, firstSolve: true });
    expect(recordFail(w.record)).toEqual({ attempts: 3, stars: 1 });
    expect(recordWin(w.record)).toEqual({ record: { attempts: 3, stars: 1 }, stars: 1, firstSolve: false });
    expect(recordWin(undefined).stars).toBe(3);
  });

  it('merges and prunes books', () => {
    expect(betterRecord({ attempts: 1 }, { attempts: 2, stars: 2 })).toEqual({ attempts: 2, stars: 2 });
    expect(betterRecord({ attempts: 3 }, { attempts: 2 })).toEqual({ attempts: 3 });
    expect(mergeBooks({ '2026-01-01': { attempts: 1 } }, { '2026-01-01': { attempts: 1, stars: 3 }, '2026-01-02': { attempts: 2 } }))
      .toEqual({ '2026-01-01': { attempts: 1, stars: 3 }, '2026-01-02': { attempts: 2 } });
    expect(pruneBook({ '2026-01-01': { attempts: 1 }, '2026-02-01': { attempts: 1 } }, '2026-01-15')).toEqual({ '2026-02-01': { attempts: 1 } });
  });
});

describe('PuzzleRun', () => {
  const puzzle: Coins = { target: 7, coins: [4, 3, 6] };

  it('plays legal actions, refuses illegal ones, and wins', () => {
    const run = new PuzzleRun(coinRules, startOf(puzzle), { search: coinSearch });
    expect(run.play({ i: 7 })).toBeNull();
    expect(run.line).toEqual([]);
    expect(run.play({ i: 0 })).toBe('playing');
    expect(run.play({ i: 0 })).toBe('won');
    expect(run.line).toEqual([{ i: 0 }, { i: 0 }]);
    expect(run.play({ i: 0 })).toBeNull();
  });

  it('fails at once when no winning line is left, and restarts', () => {
    const run = new PuzzleRun(coinRules, startOf(puzzle));
    expect(run.play({ i: 2 })).toBe('failed');
    expect(run.status).toBe('failed');
    run.restart();
    expect(run).toMatchObject({ status: 'playing', line: [], state: startOf(puzzle) });
  });

  it('takes a game-specific winnable check', () => {
    const run = new PuzzleRun(coinRules, startOf(puzzle), { winnable: (s) => s.left.length > 1 });
    expect(run.play({ i: 2 })).toBe('playing');
    expect(run.play({ i: 0 })).toBe('failed');
  });
});

describe('replay', () => {
  const start = startOf({ target: 7, coins: [4, 3, 6] });

  it('a legal line that ends on the goal is a win', () => {
    expect(replayLine(coinRules, start, [{ i: 1 }, { i: 0 }])).toMatchObject({ ok: true });
  });

  it('reports illegal, short and over-long lines', () => {
    expect(replayLine(coinRules, start, [{ i: 5 }])).toMatchObject({ ok: false, fault: 'illegal', at: 0 });
    expect(replayLine(coinRules, start, [{ i: 0 }])).toMatchObject({ ok: false, fault: 'not-won', at: 1 });
    expect(replayLine(coinRules, { ...start, left: [4, 3, 1] }, [{ i: 0 }, { i: 0 }, { i: 0 }])).toMatchObject({ ok: false, fault: 'won-early', at: 2 });
  });

  it('verifyDailyLine rebuilds the puzzle from the seed', () => {
    const v = { build: (seed: number) => ({ target: 4 + (seed % 2), coins: [4, 1] }), start: startOf, rules: coinRules };
    expect(verifyDailyLine(v, 2, '2026-01-01', [{ i: 0 }]).ok).toBe(true);
    expect(verifyDailyLine(v, 3, '2026-01-01', [{ i: 0 }]).ok).toBe(false);
  });
});

describe('versions', () => {
  const versions: GenVersion<string>[] = [
    { version: 1, from: null, build: 'v1' },
    { version: 2, from: '2026-11-01', build: 'v2' },
    { version: 4, from: '2027-01-01', build: 'v4' },
  ];

  it('a day uses the newest version whose cutoff it has reached', () => {
    expect(versionFor(versions, '2026-10-31').build).toBe('v1');
    expect(versionFor(versions, '2026-11-01').build).toBe('v2');
    expect(versionFor(versions, '2026-12-31').build).toBe('v2');
    expect(versionFor(versions, '2030-01-01').build).toBe('v4');
    expect(versionNumbered(versions, 2)?.build).toBe('v2');
    expect(versionNumbered(versions, 3)).toBeNull();
  });

  it('rejects a bad list', () => {
    expect(() => checkVersions([])).toThrow();
    expect(() => checkVersions([versions[0], { version: 1, from: '2026-01-01', build: 'x' }])).toThrow(/after/);
    expect(() => checkVersions([versions[0], { version: 2, from: null, build: 'x' }])).toThrow(/from day/);
    expect(() => checkVersions([versions[0], versions[2], { version: 5, from: '2026-12-01', build: 'x' }])).toThrow(/not after/);
    expect(() => versionFor(versions, '2026-02-30')).toThrow();
  });
});

describe('hub bridge', () => {
  function fakeDaily(active: DailyHub['active']) {
    const sent: JsonObject[] = [];
    let cancels = 0;
    const daily: DailyHub & { active: DailyHub['active'] } = {
      active,
      complete: (meta) => { sent.push(meta); daily.active = null; },
      cancel: () => { cancels++; daily.active = null; },
    };
    return { daily, sent, cancels: () => cancels };
  }

  it('winMeta: score is the stars; the game\'s extras never replace the standard fields', () => {
    expect(winMeta({ stars: 2, attempts: 2, gen: 1, line: [{ t: 'x' }], extra: { score: 99, phase: 6 } }))
      .toEqual({ phase: 6, score: 2, stars: 2, attempts: 2, gen: 1, line: [{ t: 'x' }] });
    expect(winMeta({ stars: 3, attempts: 1, gen: 1 })).not.toHaveProperty('line');
  });

  it('completes only while a daily is active, once', () => {
    const f = fakeDaily({ day: '2026-10-14', seed: 5 });
    expect(inDaily(f.daily)).toBe(true);
    expect(inDaily(f.daily, '2026-10-13')).toBe(false);
    expect(completeDaily(f.daily, { stars: 3, attempts: 1, gen: 1 })).toBe(true);
    expect(completeDaily(f.daily, { stars: 3, attempts: 1, gen: 1 })).toBe(false);
    expect(f.sent).toHaveLength(1);
    expect(inDaily(f.daily)).toBe(false);
  });

  it('cancels only an active daily', () => {
    const f = fakeDaily(null);
    cancelDaily(f.daily);
    expect(f.cancels()).toBe(0);
    f.daily.active = { day: '2026-10-14', seed: 5 };
    cancelDaily(f.daily);
    cancelDaily(f.daily);
    expect(f.cancels()).toBe(1);
  });
});
