// The game's own tests (GAME: yours to edit). TODO(game): test your rules: determinism, the daily, endings.
import { describe, expect, it } from 'vitest';
import { newRun, outcome, progress, solve, step } from '../../src/game/rules.ts';
import { isRun } from '../../src/game/state.ts';
import { wordingProblems } from '../../src/kit/core/index.ts';

/** Play `steps` fixed steps. */
function playFor(seed: number, mode: 'normal' | 'daily' | 'race', steps: number) {
  const run = newRun(mode, seed);
  for (let i = 0; i < steps && outcome(run) === null; i++) step(run, 1 / 60, {});
  return run;
}

describe('rules', () => {
  it('the same seed builds the same game (dailies and races are fair)', () => {
    expect(newRun('daily', 99)).toEqual(newRun('daily', 99));
    expect(playFor(7, 'race', 600)).toEqual(playFor(7, 'race', 600));
  });

  it('a saved game round-trips through JSON and validates (Continue)', () => {
    const run = playFor(5, 'normal', 300);
    const back: unknown = JSON.parse(JSON.stringify(run));
    expect(back).toEqual(run);
    expect(isRun(run)).toBe(true);
    expect(isRun({ ...run, score: null })).toBe(false);
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
