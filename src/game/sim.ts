/**
 * How the balance sim plays this game (`npm run sim`, tests/game/sim.test.ts). (GAME: yours to edit.)
 *
 * The sim stops a game after `maxSteps` (default 36,000: 10 minutes) and
 * reports it as a `timeout`; an endless mode sets its own `maxSteps` here.
 */
import type { PlayMode } from '../kit/core/index.ts';
import type { SimSpec } from '../kit/testing/sim.ts';
import { newRun, outcome, step, type StepInput } from './rules.ts';
import type { Run } from './state.ts';

/** TODO(game): a policy like a real player's (a little slow, a little wrong), and the numbers you tune. */
export function simSpec(mode: PlayMode, skill = 0.8): SimSpec<Run, StepInput> {
  // A player who presses every few steps; a better one presses more often.
  const every = 2 + Math.round(20 * (1 - skill));
  return {
    start: (seed) => newRun(mode, seed),
    policy: (_run, n) => ({ press: n % every === 0 }),
    step: (run, dt, input) => void step(run, dt, input),
    outcome,
    measure: (run) => ({ seconds: run.t, score: run.score }),
  };
}
