// The live sim's conformance (GAME: yours to edit), with the hub's own checkLiveSimRuns.
// TODO(game): add your sim's own cases (a lap counts, a collision bounces, the race ends).
import { describe, expect, it } from 'vitest';
import sim from '../../src/game/live/sim.ts';
import { checkLiveSimRuns } from '../../src/kit/live/index.ts';

describe('live sim', () => {
  it('passes checkLiveSimRuns: repeatable, every field survives the wire, snapshots fit a datagram', () => {
    // TODO(game): your seat count (game.live.players).
    const report = checkLiveSimRuns(sim, { seats: 2 });
    expect(report.problems).toEqual([]);
  });
});
