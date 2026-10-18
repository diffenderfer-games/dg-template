/**
 * The live sim the hub's live server runs for realtime play, and the page runs to predict (docs/kit/live.md). (GAME: yours to edit.)
 *
 * Pure: no DOM, no hub, no Math.random, no Date, no imports at all after
 * bundling (`npm run build:live`, part of `npm run build` once `game.live` is
 * declared → dist-live/sim.mjs). Randomness only from `ctx.rng`; trig from
 * `dmath` (Math.sin and friends differ between browsers).
 *
 * To play it live, declare it in package.json `game.live` (docs/kit/live.md).
 * Tests: tests/game/live.test.ts (the hub's checkLiveSimRuns).
 */
import { defineLiveSim } from '../../kit/live/sim.ts';

export default defineLiveSim({
  version: 1,
  tickRate: 30,
  /** TODO(game): world fields (f.int, f.float, f.bool, f.enum, f.angle): the race phase, a timer… */
  world: {},
  /** TODO(game): one seat's input for one tick, e.g. `{ steer: f.float(-1, 1, 8), throttle: f.float(0, 1, 6) }`. */
  input: {},
  /** TODO(game): entity kinds and their fields, e.g. `{ car: { fields: { x: f.float(-500, 500, 18), … } } }`. */
  entities: {},
  setup() {
    // TODO(game): spawn the starting entities (`ctx.spawn(kind, seat, values)`) and return the world's values.
    return {};
  },
  step() {
    // TODO(game): one fixed step: move every entity by `inputs[entity.owner]` and `ctx.dt`.
  },
  // TODO(game): outcome(state) → { places: [seat, …] } once it is over (null until then).
  // TODO(game): autoInput(state, seat, rng) → the computer's input (bots, dropped players), with `game.live.bots`.
});
