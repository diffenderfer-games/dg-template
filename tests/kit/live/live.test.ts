import { describe, expect, it } from 'vitest';
import { checkLiveSimRuns, defineLiveSim, dmath, f } from '../../../src/kit/live/index.ts';

/** A tiny sim: a dot that turns and moves. */
const dot = defineLiveSim({
  version: 1,
  tickRate: 20,
  world: {},
  input: { turn: f.float(-1, 1, 8) },
  entities: { dot: { fields: { x: f.float(-100, 100, 16), y: f.float(-100, 100, 16), angle: f.angle(12) } } },
  setup(ctx) {
    for (let seat = 0; seat < ctx.seats; seat += 1) ctx.spawn('dot', seat);
    return {};
  },
  step(state, inputs, ctx) {
    for (const dot of state.entities.values()) {
      dot.angle += (inputs[dot.owner]?.turn ?? 0) * ctx.dt;
      dot.x += dmath.dcos(dot.angle) * 5 * ctx.dt;
      dot.y += dmath.dsin(dot.angle) * 5 * ctx.dt;
    }
  },
  autoInput: (_state, _seat, rng) => ({ turn: rng.next() * 2 - 1 }),
});

describe('kit/live', () => {
  it("a sim built from the kit passes the hub's conformance check", () => {
    expect(checkLiveSimRuns(dot, { seats: 3, ticks: 100 }).problems).toEqual([]);
  });

  it('dmath stays close to Math', () => {
    expect(dmath.dsin(1.2)).toBeCloseTo(Math.sin(1.2), 8);
    expect(dmath.datan2(-1, -1)).toBeCloseTo(Math.atan2(-1, -1), 6);
  });
});
