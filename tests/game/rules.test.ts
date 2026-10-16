// The game's own tests (GAME: yours to edit). Examples: determinism, the daily, the saved-game shape.
import { describe, expect, it } from 'vitest';
import { autoInput, newRun, outcome, progress, solve, step } from '../../src/game/rules.ts';
import { isRun } from '../../src/game/state.ts';
import { wordingProblems } from '../../src/kit/core/index.ts';

/** Play `steps` fixed steps like the autoplay driver. */
function playFor(seed: number, mode: 'normal' | 'daily' | 'race', steps: number) {
  const run = newRun(mode, seed);
  for (let i = 0; i < steps && outcome(run) === null; i++) step(run, 1 / 60, autoInput(run));
  return run;
}

describe('rules (TODO(game): your rules tests)', () => {
  it('the same seed builds the same game (dailies and races are fair)', () => {
    expect(newRun('daily', 99)).toEqual(newRun('daily', 99));
    expect(playFor(7, 'race', 600)).toEqual(playFor(7, 'race', 600));
  });

  it('the daily builds the same day for the same seed, and finishing it wins', () => {
    const run = playFor(2026, 'daily', 60 * 20);
    expect(run.target).toBeGreaterThanOrEqual(15);
    expect(outcome(run)).toBe('won');
  });

  it('a normal game ends when time is up', () => {
    const run = newRun('normal', 3);
    for (let i = 0; i < 31 * 60; i++) step(run, 1 / 60, { press: false });
    expect(outcome(run)).toBe('won');
    expect(run.score).toBe(0);
  });

  it('a saved game round-trips through JSON and validates (Continue)', () => {
    const run = playFor(5, 'normal', 300);
    const back: unknown = JSON.parse(JSON.stringify(run));
    expect(back).toEqual(run);
    expect(isRun(run)).toBe(true);
    expect(isRun({ ...run, score: null })).toBe(false);
  });

  it('a restored game continues exactly like the original (the RNG state is saved)', () => {
    const a = playFor(11, 'normal', 300);
    const b = structuredClone(a);
    for (let i = 0; i < 400; i++) {
      step(a, 1 / 60, autoInput(a));
      step(b, 1 / 60, autoInput(b));
    }
    expect(b).toEqual(a);
  });

  it('progress labels are kid-friendly and short (never "run")', () => {
    for (const mode of ['normal', 'daily', 'race'] as const)
      expect(wordingProblems(progress(newRun(mode, 1)).label)).toEqual([]);
  });

  it('solve wins at once (the test driver)', () => {
    const run = newRun('race', 4);
    solve(run);
    expect(outcome(run)).toBe('won');
  });
});
