import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonObject } from '../../../src/kit/core/index.ts';
import { LiveRoomMatch, type LiveRoomGame, type LiveStart } from '../../../src/kit/live/index.ts';
import { createFakeHub, fakeSeat, type FakeRoom } from '../../../src/kit/testing/index.ts';

/** The live connection: `live.join(room)` (the hub's live server isn't in a unit test). */
const joins: { room: string; close: () => void }[] = [];
let failJoins = 0;
vi.mock('@diffenderfer-games/hub/live', async (original) => ({
  ...(await original<object>()),
  joinLiveRoom: (room: { info: { code: string } }) => {
    if (failJoins > 0) {
      failJoins -= 1;
      return Promise.reject(Object.assign(new Error('no_match'), { code: 'live_unavailable' }));
    }
    let onClose: (reason: string) => void = () => undefined;
    const match = {
      seat: 0,
      input: () => undefined,
      view: () => ({ tick: 0, world: {}, entities: [], of: () => [] }),
      onMessage: () => undefined,
      onClose: (l: (reason: string) => void) => {
        onClose = l;
      },
      leave: () => undefined,
    };
    joins.push({ room: room.info.code, close: () => onClose('dropped') });
    return Promise.resolve(match);
  },
}));

/** A live game's hooks that record what the kit asked. */
function game(o: { options?: JsonObject; seat?: JsonObject } = {}) {
  const calls: string[] = [];
  const starts: LiveStart[] = [];
  const hooks: LiveRoomGame = {
    sim: { version: 1, tickRate: 30, world: {}, input: {}, entities: {}, setup: () => ({}), step: () => undefined },
    options: () => o.options ?? { track: 7 },
    seat: () => o.seat ?? { car: 'red' },
    prepare: (start, progress) => {
      starts.push(start);
      progress(0.5, 'Building');
      calls.push('prepare');
      return Promise.resolve();
    },
    play: () => calls.push('play'),
    frame: () => calls.push('frame'),
    render: () => undefined,
    stop: () => calls.push('stop'),
  };
  return { hooks, calls, starts };
}

/** Events the match tells the flow. */
function events() {
  const seen: string[] = [];
  return {
    seen,
    on: {
      lobby: () => seen.push('lobby'),
      loading: (f: number, label: string) => seen.push(`loading ${String(f)} ${label}`),
      playing: () => seen.push('playing'),
      ended: () => seen.push('ended'),
      left: (text: string | null) => seen.push(`left ${text ?? ''}`),
      problem: (text: string) => seen.push(`problem ${text}`),
    },
  };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  joins.length = 0;
  failJoins = 0;
});

describe('LiveRoomMatch', () => {
  it("the host shares the options in the room and starts with them; seats carry each player's choices", async () => {
    const fake = createFakeHub({ user: { id: 1, username: 'ann', guest: false } });
    const g = game({ options: { track: 42 } });
    const e = events();
    const m = new LiveRoomMatch(fake, g.hooks, e.on);
    await m.create();
    expect(fake.log.named('room.seat')[0]?.args).toEqual([{ car: 'red' }]);
    expect(fake.log.named('room.setState')[0]?.args[0]).toEqual({ options: { track: 42 } });
    expect(m.options).toEqual({ track: 42 });
    expect(fake.log.count('room.ready')).toBe(0); // (the host is never "ready")
    m.start();
    await flush();
    expect(fake.log.named('room.start')[0]?.args).toEqual([{ track: 42 }]);
  });

  it('a guest says it is ready and builds, joins and plays once the room plays', async () => {
    const fake = createFakeHub({ user: { id: 2, username: 'bob', guest: false } });
    const g = game();
    const e = events();
    const m = new LiveRoomMatch(fake, g.hooks, e.on);
    await m.join('ABCDE');
    expect(fake.log.named('room.ready')[0]?.args).toEqual([true]);
    const room = fake.rooms.current;
    if (!room) throw new Error('no room');
    room.state = { options: { track: 9 } };
    room.setInfo({ phase: 'playing' });
    await flush();
    await flush();
    expect(g.starts[0]).toMatchObject({ room: 'ABCDE', me: 1, options: { track: 9 } });
    expect(g.starts[0]?.seats.map((s) => s.userId)).toEqual([1, 2]);
    expect(e.seen).toContain('loading 0.5 Building');
    expect(g.calls).toEqual(['prepare', 'play']);
    expect(e.seen.at(-1)).toBe('playing');
    expect(joins).toHaveLength(1);
    expect(fake.mp.busy).toBe(true);
    m.frame(1 / 60);
    expect(g.calls.at(-1)).toBe('frame');
  });

  it("a dropped connection joins again; the hub's end shows the places and who won", async () => {
    vi.useFakeTimers();
    try {
      const fake = createFakeHub({ user: { id: 2, username: 'bob', guest: false } });
      const g = game();
      const e = events();
      const m = new LiveRoomMatch(fake, g.hooks, e.on);
      await m.join('ABCDE');
      const room: FakeRoom | null = fake.rooms.current;
      room?.setInfo({ phase: 'playing' });
      await vi.runAllTimersAsync();
      expect(joins).toHaveLength(1);
      joins[0]?.close();
      await vi.advanceTimersByTimeAsync(2000);
      expect(joins).toHaveLength(2);
      expect(g.calls.filter((c) => c === 'play')).toHaveLength(2);
      room?.endedBy({ places: [2, 1], winnerId: 2 });
      expect(e.seen.at(-1)).toBe('ended');
      expect(m.won({ places: [2, 1], winnerId: 2 })).toBe(true);
      expect(LiveRoomMatch.places({ places: [2, 1], winnerId: 2 })).toEqual([2, 1]);
      expect(fake.mp.busy).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a reload during the match takes the seat back and joins at once', async () => {
    const fake = createFakeHub({ user: { id: 2, username: 'bob', guest: false } });
    const g = game();
    const e = events();
    const m = new LiveRoomMatch(fake, g.hooks, e.on);
    await m.join('ABCDE');
    fake.rooms.held = fake.rooms.current;
    fake.rooms.current?.setInfo({ phase: 'playing', seats: [fakeSeat(1), fakeSeat(2)] });
    await flush();
    await flush();
    m.leave();
    expect(g.calls.at(-1)).toBe('stop');
    const again = new LiveRoomMatch(fake, g.hooks, events().on);
    expect(await again.reclaim()).toBe(true);
    await flush();
    await flush();
    expect(joins).toHaveLength(2);
  });
});

describe('LiveRoomMatch building', () => {
  it('a build that fails is tried again; one that keeps failing takes the player back', async () => {
    vi.useFakeTimers();
    try {
      const fake = createFakeHub({ user: { id: 2, username: 'bob', guest: false } });
      const g = game();
      let fails = 2;
      g.hooks.prepare = () => (fails-- > 0 ? Promise.reject(new Error('no world')) : Promise.resolve());
      const e = events();
      const m = new LiveRoomMatch(fake, g.hooks, e.on);
      await m.join('ABCDE');
      fake.rooms.current?.setInfo({ phase: 'playing' });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(g.calls).toContain('play');
      const never = game();
      never.hooks.prepare = () => Promise.reject(new Error('no world'));
      const e2 = events();
      const m2 = new LiveRoomMatch(fake, never.hooks, e2.on);
      await m2.join('FGHIJ');
      fake.rooms.current?.setInfo({ phase: 'playing' });
      await vi.advanceTimersByTimeAsync(120_000);
      expect(e2.seen.at(-1)).toMatch(/^left /);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('LiveRoomMatch after a reload', () => {
  it('the seat taken back twice (reclaim, then the rejoin launch) still builds once more and joins', async () => {
    const fake = createFakeHub({ user: { id: 2, username: 'bob', guest: false } });
    const g = game();
    let release: () => void = () => undefined;
    let first = true;
    g.hooks.prepare = () => {
      if (!first) return Promise.resolve();
      first = false;
      return new Promise<void>((r) => (release = r));
    };
    const m = new LiveRoomMatch(fake, g.hooks, events().on);
    await m.join('ABCDE');
    fake.rooms.current?.setInfo({ phase: 'playing' });
    await flush();
    // The rejoin launch arrives while the first build is still going: the room is joined again.
    const again = fake.rooms.current;
    await m.join('ABCDE');
    fake.rooms.current?.setInfo({ phase: 'playing' });
    release();
    await flush();
    await flush();
    expect(again).not.toBeNull();
    expect(joins).toHaveLength(1);
    expect(g.calls.filter((c) => c === 'play')).toHaveLength(1);
  });
});
