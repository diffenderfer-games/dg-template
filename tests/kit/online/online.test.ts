import { describe, expect, it } from 'vitest';
import type { Json } from '../../../src/kit/core/index.ts';
import {
  envelope,
  errText,
  fits,
  freshest,
  installLaunches,
  onlineGame,
  parseEnvelope,
  successorOf,
  WIRE_VERSION,
} from '../../../src/kit/online/index.ts';
import { createFakeHub, fakeRoomInfo, fakeSeat } from '../../../src/kit/testing/index.ts';

describe('wire', () => {
  it('round-trips an envelope; other versions and kinds are dropped', () => {
    const e = envelope('in', { x: 1 }, 5);
    expect(parseEnvelope(JSON.parse(JSON.stringify(e)))).toEqual(e);
    expect(parseEnvelope({ ...e, v: WIRE_VERSION + 1 })).toBeNull();
    expect(parseEnvelope({ ...e, t: 'hack' })).toBeNull();
    expect(parseEnvelope('nope')).toBeNull();
  });

  it('8 KB per message', () => {
    expect(fits(envelope('view', 'x'.repeat(9000), 0))).toBe(false);
    expect(fits(envelope('view', 'x'.repeat(100), 0))).toBe(true);
  });

  it('the successor is the longest-seated connected non-host; the freshest backup wins (uno wire.ts)', () => {
    const info = fakeRoomInfo({
      hostId: 1,
      seats: [fakeSeat(1), fakeSeat(2, { connected: false }), fakeSeat(3), fakeSeat(4)],
    });
    expect(successorOf(info)).toBe(3);
    expect(freshest([{ at: 1 }, { at: 9 }, { at: 3 }])).toEqual({ at: 9 });
    expect(freshest([])).toBeNull();
  });

  it('errors become kid words', () => {
    expect(errText(Object.assign(new Error(), { code: 'room_not_found' }))).toBe("That game isn't there any more.");
    expect(errText(Object.assign(new Error(), { code: 'suspended' }))).toMatch(/switched off/);
    expect(errText(new Error('raw'))).toBe('Something went wrong. Try again.');
  });
});

describe('launch adapter', () => {
  it('waits for mount, then routes once; identical launches and race launches are ignored', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    const routed: string[] = [];
    const l = installLaunches(fake, {
      host: (x) => {
        routed.push(`host:${x.partyId ?? ''}`);
        return new Promise(() => undefined); // still being handled
      },
      join: (room) => {
        routed.push(`join:${room}`);
        return Promise.resolve();
      },
      currentRoom: () => null,
    });
    fake.mp.launch({ kind: 'host', partyId: 'p' });
    expect(routed).toEqual([]);
    expect(l.ready()).toBe(true);
    fake.mp.launch({ kind: 'host', partyId: 'p' });
    fake.mp.launch({ kind: 'join', room: 'R', mode: 'race' });
    await fake.clock.settle();
    expect(routed).toEqual(['host:p']);
  });
});

describe('onlineGame: typed hooks behind JSON', () => {
  type S = { n: number; by: number[] };
  const game = onlineGame<S, { n: number }, { add: number }>({
    start: () => ({ n: 0, by: [] }),
    apply: (s, from, m) => {
      s.n += m.add;
      s.by.push(from);
    },
    computer: () => ({ add: 10 }),
    view: (s) => ({ n: s.n }),
    outcome: (s) => (s.n >= 20 ? { winners: [1] } : null),
    input: () => null,
    render: () => undefined,
    isState: (x: Json): x is S =>
      typeof x === 'object' && x !== null && !Array.isArray(x) && typeof x.n === 'number' && Array.isArray(x.by),
    isView: (x: Json): x is { n: number } =>
      typeof x === 'object' && x !== null && !Array.isArray(x) && typeof x.n === 'number',
    isInput: (x: Json): x is { add: number } =>
      typeof x === 'object' && x !== null && !Array.isArray(x) && typeof x.add === 'number',
  });

  it('validates input, runs computer seats, and restores from a backup', () => {
    const host = game.start({ seats: [1, 2], seed: 1 });
    expect(host.apply(1, { add: 'x' })).toBe(false);
    expect(host.apply(1, { add: 1 })).toBe(true);
    host.step(1 / 60, new Set([2]));
    expect(host.view(null)).toEqual({ n: 11 });
    const backup = host.backup();
    host.step(1 / 60, new Set([2]));
    expect(host.outcome()).toEqual({ winners: [1] });
    const restored = game.restore(backup);
    expect(restored?.view(null)).toEqual({ n: 11 });
    expect(game.restore({ junk: 1 })).toBeNull();
  });
});
