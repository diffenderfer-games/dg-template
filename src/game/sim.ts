/**
 * How the balance sim plays this game (`npm run sim`, tests/game/sim.test.ts). (GAME: yours to edit.)
 */
import type { PlayMode } from '../kit/core/index.ts';
import type { SimSpec } from '../kit/testing/sim.ts';
import { newRun, outcome, steerToCoin, step, type StepInput } from './rules.ts';
import type { Run } from './state.ts';

/** TODO(game): a policy like a real player's (a little slow, a little wrong), and the numbers you tune. */
export function simSpec(mode: PlayMode, skill = 0.8): SimSpec<Run, StepInput> {
  return {
    start: (seed) => newRun(mode, seed),
    // A player who heads for the coin, but only `skill` of the time (wanders otherwise).
    policy: (run, n) => (Math.sin(n * 0.37 + run.seed) * 0.5 + 0.5 < skill ? steerToCoin(run) : { x: 0, y: 0 }),
    step: (run, dt, input) => void step(run, dt, input),
    outcome,
    measure: (run) => ({ seconds: run.t, coins: run.score }),
  };
}
