import { describe, expect, it } from 'vitest';
import { choiceCount, choicesAlong, findWinningLines, firstMoveOutcomes, hasWinningLine } from '../../../src/kit/daily-puzzle/index.ts';
import { coinRules, coinSearch, startOf, type CoinState, type Take } from './toy.ts';

const start = startOf({ target: 8, coins: [3, 5, 3, 2] });

describe('findWinningLines', () => {
  it('finds every winning line, by action', () => {
    const r = findWinningLines(coinRules, start);
    // 3+5, 5+3 (each with either 3), 3+3+2 in every order…
    expect(r.stopped).toBeNull();
    expect(r.lines.length).toBe(4 + 6);
    for (const line of r.lines) {
      let s = start;
      for (const a of line) s = coinRules.apply(s, a)!;
      expect(coinRules.won(s)).toBe(true);
    }
  });

  it('merges equivalent lines through stepKey (equal coins)', () => {
    const r = findWinningLines(coinRules, start, coinSearch);
    const keys = r.lines.map((l) => {
      let s = start;
      return l.map((a) => { const v = s.left[a.i]; s = coinRules.apply(s, a)!; return v; }).join('+');
    });
    expect(keys.sort()).toEqual(['2+3+3', '3+2+3', '3+3+2', '3+5', '5+3']);
  });

  it('a blank step key leaves the step out of the line (orderings merge)', () => {
    // only the coin taken last counts: 3+5 / 5+3 / 3+3+2 / … end on 5, 3 or 2
    const lastOnly = (s: CoinState, a: Take) => (s.total + s.left[a.i] === s.target ? `last ${s.left[a.i]}` : '');
    const r = findWinningLines(coinRules, start, { stepKey: lastOnly });
    expect(r.lines.length).toBe(3);
  });

  it('stateKey skips positions already searched, finding the same lines with fewer nodes', () => {
    const blank = { stepKey: () => '' };
    const plain = findWinningLines(coinRules, start, blank);
    const keyed = findWinningLines(coinRules, start, { ...blank, stateKey: (s: CoinState) => `${s.total}|${s.left.slice().sort().join(',')}` });
    expect(keyed.lines.length).toBe(plain.lines.length);
    expect(keyed.lines.length).toBe(1);
    expect(keyed.nodes).toBeLessThan(plain.nodes);
  });

  it('stateKey keeps the count exact: routes into a searched position still each count', () => {
    // the exact coins left, in order: the same actions do the same thing from equal keys
    const key = (s: CoinState) => `${s.total}|${s.left.join(',')}`;
    for (const opts of [{}, coinSearch]) {
      const plain = findWinningLines(coinRules, start, opts);
      const keyed = findWinningLines(coinRules, start, { ...opts, stateKey: key });
      expect(keyed.lines.map((l) => JSON.stringify(l)).sort()).toEqual(plain.lines.map((l) => JSON.stringify(l)).sort());
    }
  });

  it('stops at the limit, the depth and the node cap', () => {
    expect(findWinningLines(coinRules, start, { ...coinSearch, limit: 2 })).toMatchObject({ stopped: 'limit', lines: { length: 2 } });
    expect(findWinningLines(coinRules, start, { ...coinSearch, maxDepth: 2 }).lines.length).toBe(2);
    const capped = findWinningLines(coinRules, start, { maxNodes: 3 });
    expect(capped.stopped).toBe('nodes');
    expect(capped.nodes).toBe(4);
  });

  it('is deterministic (moves order)', () => {
    expect(findWinningLines(coinRules, start, coinSearch)).toEqual(findWinningLines(coinRules, start, coinSearch));
  });

  it('a won start is one empty line; a dead start has none', () => {
    expect(findWinningLines(coinRules, { total: 8, target: 8, left: [1] }).lines).toEqual([[]]);
    expect(findWinningLines(coinRules, { total: 9, target: 8, left: [1] }).lines).toEqual([]);
  });
});

describe('hasWinningLine, firstMoveOutcomes, choicesAlong', () => {
  it('hasWinningLine', () => {
    expect(hasWinningLine(coinRules, start)).toBe(true);
    expect(hasWinningLine(coinRules, startOf({ target: 4, coins: [3, 3] }))).toBe(false);
  });

  it('firstMoveOutcomes marks which first moves can still win', () => {
    const s = startOf({ target: 7, coins: [4, 3, 6] });
    expect(firstMoveOutcomes(coinRules, s)).toEqual([
      { action: { i: 0 }, wins: true }, { action: { i: 1 }, wins: true }, { action: { i: 2 }, wins: false },
    ]);
  });

  it('choicesAlong counts the distinct options before each step, and throws on an illegal one', () => {
    expect(choicesAlong(coinRules, start, [{ i: 1 }, { i: 0 }])).toEqual([4, 3]);
    // coins 3, 5, 3, 2: the two 3s are one choice
    expect(choiceCount(coinRules, start, coinSearch)).toBe(3);
    expect(choicesAlong(coinRules, start, [{ i: 1 }, { i: 0 }], coinSearch)).toEqual([3, 2]);
    expect(() => choicesAlong(coinRules, start, [{ i: 9 }])).toThrow(/illegal/);
  });
});
