// Appendix B rows 34–55: launches, rooms, seats, chat, social, presence, the runtime.
import { expect, it } from 'vitest';
import type { RoomSeat } from '@diffenderfer-games/hub';
import { field } from '../../src/kit/core/json.ts';
import type { KeyValue } from '../../src/kit/core/store.ts';
import { HELD_INPUTS } from '../../src/kit/online/match.ts';
import { carryEnvelope, envelope } from '../../src/kit/online/wire.ts';
import { FakeRoom, fakeRoomInfo, fakeSeat, fakeStorage, type FakeHub } from '../../src/kit/testing/index.ts';
import { bootGame, describeIf, HAS, type Booted } from './_support/harness.ts';
import { toyOnline, toyView } from './_support/toys.ts';

/** The online suites run only for a game with online play in hub rooms. */
const describe = describeIf(HAS.online, 'this game declares no game.multiplayer');

/** Boot with the toy online game in place of the game's own: these suites test the kit's rooms, not one game's rules. */
const boot = (o: Parameters<typeof bootGame>[0] = {}): Promise<Booted> =>
  bootGame({ ...o, patch: { online: toyOnline(), ...o?.patch } });

/** The fake room the player is in. */
function roomOf(g: Booted): FakeRoom {
  const r = g.fake.rooms.current;
  if (!r) throw new Error('not in a room');
  return r;
}

/** A seat held after a reload: `me`'s, in room-1 already playing, hosted by `me`. */
function heldRoom(f: FakeHub, me: number, seats: RoomSeat[]): FakeRoom {
  const info = fakeRoomInfo({ game: f.slug, phase: 'playing', hostId: me, seats });
  return new FakeRoom(f.log, { userId: me, host: true, spectator: false }, info).newer();
}

/** Every key in a storage. */
const keysOf = (kv: KeyValue): string[] =>
  Array.from({ length: kv.length }, (_, i) => kv.key(i)).filter((k): k is string => k !== null);

/** A copy of a storage (what a reloaded page finds). */
function copyOf(kv: KeyValue): KeyValue {
  const copy = fakeStorage();
  for (const k of keysOf(kv)) copy.setItem(k, kv.getItem(k) ?? '');
  return copy;
}

/** The last public view a host sent, as text. */
const lastView = (room: FakeRoom): string =>
  JSON.stringify(room.sent.filter((m) => JSON.stringify(m.data).includes('"t":"view"')).at(-1)?.data);

/** Host a room from the title, seat a second player, start. */
async function hostAndStart(g: Booted): Promise<FakeRoom> {
  g.press('online');
  g.press('online-friends');
  await g.settle();
  const room = roomOf(g);
  room.addSeat(2, { ready: true });
  g.press('lobby-start');
  await g.frames(2);
  return room;
}

describe('launches (multiplayer.md §6)', () => {
  it('row 34: host: onLaunch is registered at boot before any await; the room is created once, for the party', async () => {
    const g = await boot();
    const names = g.fake.log.names();
    expect(names.indexOf('mp.onLaunch')).toBeLessThan(names.indexOf('getSave'));
    g.fake.mp.launch({ kind: 'host', partyId: 'p1' });
    g.fake.mp.launch({ kind: 'host', partyId: 'p1' });
    await g.settle();
    expect(g.fake.log.count('rooms.create')).toBe(1);
    expect(g.fake.log.last('mp.setJoinInfo')?.args).toEqual(['p1', { room: 'ABCDE' }]);
    expect(g.hook.screen()).toBe('lobby');
  });

  it('row 35: guest: joins the join info now, or when onJoinInfo brings it (row 41)', async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'guest', partyId: 'p1', joinInfo: { room: 'ROOM1' } });
    await g.settle();
    expect(g.fake.log.last('rooms.join')?.args[0]).toBe('ROOM1');

    const w = await boot();
    w.fake.mp.launch({ kind: 'guest', partyId: 'p2' });
    await w.settle();
    expect(w.fake.log.count('rooms.join')).toBe(0);
    w.fake.mp.joinInfo('p2', { room: 'ROOM2' });
    await w.settle();
    expect(w.fake.log.last('rooms.join')?.args[0]).toBe('ROOM2');
  });

  it('row 36: join (also via an invite link or a rejoin) joins launch.room', async () => {
    for (const via of [undefined, 'link', 'rejoin'] as const) {
      const g = await boot();
      g.fake.mp.launch(via === undefined ? { kind: 'join', room: 'JOIN1' } : { kind: 'join', room: 'JOIN1', via });
      await g.settle();
      expect(g.fake.log.last('rooms.join')?.args, String(via)).toEqual(['JOIN1', false]);
    }
  });

  it('row 37: watch joins as a spectator and sends no input', async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'watch', room: 'W1' });
    await g.settle();
    expect(g.fake.log.last('rooms.join')?.args).toEqual(['W1', true]);
    const room = roomOf(g);
    room.receive(1, envelope('view', toyView(), 1));
    await g.frames(30);
    expect(room.sent).toHaveLength(0);
  });

  it('row 38: a tournament match offers no "Play again"', async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'host', partyId: 't1', tournament: { id: 1, title: 'Cup', match: 'm1', opponent: null } });
    await g.settle();
    const room = roomOf(g);
    room.addSeat(2, { ready: true });
    g.press('lobby-start');
    room.endedBy({ winners: [1] });
    expect(g.hook.screen()).toBe('result');
    expect(g.ui.querySelector('[data-testid="play-again"]')).toBeNull();
  });

  it("row 39: a race launch is the hub's (it joins the race itself)", async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'guest', mode: 'race', partyId: 'r', joinInfo: { room: 'R' } });
    await g.settle();
    expect(g.fake.log.count('rooms.join')).toBe(0);
  });

  it('row 40: a launch before mount waits, is handled once, and wins over the title', async () => {
    const g = await boot({ before: (f) => f.mp.launch({ kind: 'join', room: 'EARLY' }) });
    expect(g.fake.log.named('rooms.join')).toHaveLength(1);
    expect(g.hook.screen()).toBe('lobby');
    expect(g.calls.count('screen.title')).toBe(0);
  });
});

describe('rooms (multiplayer.md §8)', () => {
  it('row 42: when the host role moves here, the freshest backup takes over and play goes on', async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'join', room: 'H1' });
    await g.settle();
    const room = roomOf(g);
    const state = (score: number) =>
      toyView([
        { id: 1, score: 0 },
        { id: 2, score },
      ]);
    room.receive(2, envelope('view', toyView(), 1));
    room.receive(2, envelope('backup', state(1), 10));
    room.receive(2, envelope('backup', state(4), 20));
    room.setInfo({ hostId: 1 });
    await g.frames(10);
    const views = room.sent.filter((m) => JSON.stringify(m.data).includes('"view"'));
    expect(views.length).toBeGreaterThan(0);
    expect(JSON.stringify(views.at(-1)?.data)).toContain('"score":4');
  });

  it('row 43: invalid messages are dropped; valid views are drawn', async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'join', room: 'V' });
    await g.settle();
    const room = roomOf(g);
    room.receive(1, { v: 99, t: 'view', d: {}, at: 0 });
    room.receive(1, envelope('view', { nope: true }, 1));
    expect(g.hook.screen()).toBe('lobby');
    room.receive(1, envelope('view', toyView(), 2));
    expect(g.hook.screen()).toBe('play');
  });

  it('a reload mid-match: back in the room already playing, the first view shows play (never stuck loading)', async () => {
    const g = await boot();
    g.fake.rooms.open = [fakeRoomInfo({ code: 'MID', phase: 'playing', hostId: 2, seats: [fakeSeat(2)] })];
    g.fake.mp.launch({ kind: 'join', room: 'MID', via: 'rejoin' });
    await g.settle();
    expect(g.hook.screen()).toBe('loading');
    roomOf(g).receive(2, envelope('view', toyView(), 1));
    expect(g.hook.screen()).toBe('play');
  });

  it("the HOST reloads mid-match: this device's copy carries the same match on; replayed inputs aren't applied twice", async () => {
    const g = await boot();
    const room = await hostAndStart(g);
    const id = g.hook.online?.matchId();
    expect(id).toEqual(expect.any(String));
    room.receive(2, envelope('in', { add: 3 }, 1), 5);
    room.seatChange(2, 'away');
    await g.frames(140); // past a backup: the successor's and this device's copy
    const saved = JSON.stringify(Object.fromEntries(keysOf(g.kv).map((k) => [k, g.kv.getItem(k)])));
    expect(saved).toContain('"score\\":3');
    expect(saved).toContain('"cs\\":[2]');

    // The reload: a new page, the same device's storage, the seat (and the host role) reclaimed in a room playing.
    const kv = copyOf(g.kv); // (the old page's teardown here leaves the room; a reload doesn't)
    const r = await boot({ kv, before: (f) => (f.rooms.held = heldRoom(f, 1, [fakeSeat(1), fakeSeat(2)])) });
    const back = roomOf(r);
    expect(r.hook.screen()).toBe('play');
    expect(r.hook.online?.hosting()).toBe(true);
    expect(r.hook.online?.matchId()).toBe(id);
    expect(r.fake.log.count('room.start')).toBe(0);
    back.receive(2, envelope('in', { add: 3 }, 1), 5); // the hub's replay of what the old page already applied
    back.receive(2, envelope('in', { add: 1 }, 2), 6);
    await r.frames(10);
    expect(lastView(back)).toContain('{"id":2,"score":4}');
  });

  it('a host back with no copy (another device) asks for the match until the successor hands it back', async () => {
    const r = await boot({ before: (f) => (f.rooms.held = heldRoom(f, 1, [fakeSeat(1), fakeSeat(2)])) });
    const back = roomOf(r);
    expect(r.hook.screen()).toBe('loading');
    const wants = (): number => back.sent.filter((m) => JSON.stringify(m.data).includes('"t":"want"')).length;
    expect(wants()).toBe(1);
    await r.frames(140);
    expect(wants()).toBeGreaterThan(1); // asked again: the guest may have been away a moment
    const state = toyView([
      { id: 1, score: 2 },
      { id: 2, score: 7 },
    ]);
    back.receive(2, carryEnvelope('handoff', { s: state, at: 10, m: 'm1', q: 4, cs: [] }), 9);
    expect(r.hook.screen()).toBe('play');
    expect(r.hook.online?.matchId()).toBe('m1');
    back.receive(2, envelope('in', { add: 1 }, 1), 3); // older than the handed-back state
    await r.frames(10);
    expect(lastView(back)).toContain('{"id":2,"score":7}');
    expect(r.fake.log.count('room.start')).toBe(0);
    const asked = wants();
    await r.frames(140);
    expect(wants()).toBe(asked); // carried on: no more asking
  });

  it("the successor hands its freshest backup to a host that asks for the match (id, last input, the computer's seats)", async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'join', room: 'H2' });
    await g.settle();
    const room = roomOf(g);
    const state = (score: number) => toyView([{ id: 2, score }]);
    room.receive(2, carryEnvelope('backup', { s: state(1), at: 10, m: 'mx', q: 3, cs: [] }));
    room.receive(2, carryEnvelope('backup', { s: state(5), at: 20, m: 'mx', q: 8, cs: [3] }));
    expect(g.hook.online?.matchId()).toBe('mx');
    room.receive(2, envelope('want', null, 30));
    const handoff = room.sent.find((m) => JSON.stringify(m.data).includes('"t":"handoff"'));
    expect(handoff?.to).toBe(2);
    expect(handoff?.data).toMatchObject({ d: state(5), at: 20, m: 'mx', q: 8, cs: [3] });
  });

  it("a guest's inputs while the host is away wait, and go in order once the host's views come again", async () => {
    let n = 0;
    const g = await boot({ patch: { online: toyOnline({ input: () => ({ add: ++n }) }) } });
    g.fake.mp.launch({ kind: 'join', room: 'IN1' });
    await g.settle();
    const room = roomOf(g);
    room.receive(2, envelope('view', toyView(), 1));
    const inputs = (): number[] =>
      room.sent.flatMap((m) => {
        const add = field(field(m.data, 'd'), 'add');
        return typeof add === 'number' ? [add] : [];
      });
    await g.frames(20);
    expect(inputs().length).toBeGreaterThan(0);
    room.seatChange(2, 'away'); // the host reloads
    const before = inputs();
    await g.frames(40);
    room.seatChange(2, 'back');
    await g.frames(20);
    expect(inputs()).toEqual(before); // nothing sent into the gap (the host has no match yet to apply it to)
    room.receive(2, envelope('view', toyView(), 2), 2);
    const after = inputs().slice(before.length);
    expect(after.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThanOrEqual(HELD_INPUTS + 1);
    expect(after).toEqual([...after].sort((a, b) => a - b)); // in the order they were made
    expect(after[0]).toBeGreaterThan(before.at(-1) ?? 0);
  });

  it("a host who ends the match or leaves drops this device's copy", async () => {
    const g = await boot();
    const room = await hostAndStart(g);
    await g.frames(140);
    expect(keysOf(g.kv).some((k) => k.includes(':online-match:'))).toBe(true);
    room.endedBy({ winners: [1] });
    expect(keysOf(g.kv).some((k) => k.includes(':online-match:'))).toBe(false);
  });

  it('row 44: an away or gone seat is played by the computer and handed back without a reset', async () => {
    const g = await boot();
    const room = await hostAndStart(g);
    room.seatChange(2, 'away');
    await g.frames(120);
    const moved = JSON.stringify(room.sent.at(-1)?.data);
    expect(moved).toContain('"id":2');
    room.seatChange(2, 'back');
    await g.frames(5);
    expect(g.hook.screen()).toBe('play');
    expect(g.fake.log.count('room.end')).toBe(0);
  });

  it('row 45: abandoned: the match goes on with the computer', async () => {
    const g = await boot();
    const room = await hostAndStart(g);
    room.seatChange(2, 'gone');
    await g.frames(10);
    expect(g.hook.screen()).toBe('play');
  });

  it('row 46: kicked: back to the title with a message', async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'join', room: 'K' });
    await g.settle();
    roomOf(g).kicked();
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toMatch(/removed you/);
  });

  it('row 47: ended is handled once; online play writes no normal board', async () => {
    const g = await boot();
    const room = await hostAndStart(g);
    room.endedBy({ winners: [1] });
    room.endedBy({ winners: [1] });
    expect(g.hook.screen()).toBe('result');
    expect(g.ui.querySelector('[data-testid="result-title"]')?.textContent).toBe('You won!');
    expect(g.fake.log.count('submitScore')).toBe(0);
    expect(g.fake.log.last('mp.setBusy')?.args[0]).toBe(false);
  });

  it('row 48: each closed reason has its own words', async () => {
    for (const [reason, words] of [
      ['empty', /Everyone left/],
      ['other_tab', /another tab/],
      ['gone', /away too long/],
      ['moved', /moved/],
    ] as const) {
      const g = await boot();
      g.fake.mp.launch({ kind: 'join', room: 'C' });
      await g.settle();
      roomOf(g).close(reason);
      await g.settle();
      expect(g.ui.querySelector('[data-testid="toast"]')?.textContent, reason).toMatch(words);
    }
  });

  it('row 51: room errors become friendly words and a safe screen', async () => {
    const g = await boot();
    g.fake.rooms.joinError = 'room_full';
    g.fake.mp.launch({ kind: 'join', room: 'FULL' });
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toBe('That game is full.');
  });
});

describe('chat, social, presence, the runtime', () => {
  it('row 49: delivered text is shown as text; a softened line says so; a rejected one keeps the draft and the hint', async () => {
    const g = await boot();
    g.press('online');
    g.press('online-friends');
    await g.settle();
    const room = roomOf(g);
    room.chatFrom(2, '<b>hi</b>');
    expect(g.ui.querySelector('[data-testid="chat-lines"] b')).toBeNull();
    expect(g.ui.querySelector('[data-testid="chat-lines"]')?.textContent).toContain('<b>hi</b>');
    const input = g.ui.querySelector<HTMLInputElement>('[data-testid="chat-input"]');
    if (!input) throw new Error('no chat input');
    room.chatOutcome = { kind: 'reject', hint: 'Links can’t be sent.', retryAfterMs: 3000 };
    input.value = 'visit example dot com';
    g.press('chat-send');
    await g.settle();
    expect(input.value).toBe('visit example dot com');
    expect(g.ui.querySelector('[data-testid="chat-note"]')?.textContent).toMatch(
      /Links can.t be sent\. Try again in 3 s\./,
    );
    room.chatOutcome = { kind: 'soften', text: 'i took damage' };
    input.value = 'i got shot';
    g.press('chat-send');
    await g.settle();
    expect(input.value).toBe('');
    expect(g.ui.querySelector('[data-testid="chat-note"]')?.textContent).toBe('Some words were changed.');
  });

  it('row 50: chatMode on / quick / off: text box, chips only, hidden', async () => {
    for (const [mode, box, chips, hidden] of [
      ['on', true, true, false],
      ['quick', false, true, false],
      ['off', false, false, true],
    ] as const) {
      const g = await boot();
      g.press('online');
      g.press('online-friends');
      await g.settle();
      g.fake.rooms.current?.setInfo({ chatMode: mode });
      const chat = g.ui.querySelector<HTMLElement>('[data-testid="chat"]');
      expect(chat?.hidden, mode).toBe(hidden);
      expect(g.ui.querySelector('[data-testid="chat-input"]') !== null, mode).toBe(box);
      expect(g.ui.querySelector('[data-testid="quick-gg"]') !== null, mode).toBe(chips);
    }
  });

  it('row 52: social events update nothing that pauses the game', async () => {
    const g = await boot();
    await g.start();
    g.fake.social.emit('counts', { online: 3, inGame: 1, friendsOnline: 1 });
    g.fake.social.emit('party', null);
    expect(g.hook.paused()).toBe(false);
  });

  it('row 53: presence per screen (coalesced), busy during the match, quiet during play', async () => {
    const g = await boot();
    const before = g.fake.log.count('presence.set');
    g.hook.toTitle?.();
    await g.settle();
    expect(g.fake.log.count('presence.set')).toBe(before);
    await g.start();
    expect(g.fake.presence.current).toMatchObject({ kind: 'playing' });
    g.hook.toTitle?.();
    await g.settle();
    await hostAndStart(g);
    expect(g.fake.mp.busy).toBe(true);
    expect(g.fake.notify.quiet).toBe(true);
    expect(g.fake.presence.current).toMatchObject({ kind: 'playing', joinable: false });
  });

  it('row 54: hub:rt-failed turns the Play online button off until hub:rt-ready', async () => {
    const g = await boot();
    g.fake.runtime(false);
    await g.settle();
    expect(g.ui.querySelector<HTMLButtonElement>('[data-testid="online"]')?.disabled).toBe(true);
    g.fake.runtime(true);
    await g.settle();
    expect(g.ui.querySelector<HTMLButtonElement>('[data-testid="online"]')?.disabled).toBe(false);
  });

  it('row 55: pass-through hub events (changes-seen, prefetch, play-online-changed, account) change nothing', async () => {
    const g = await boot();
    await g.start();
    for (const ev of ['hub:changes-seen', 'hub:prefetch', 'hub:play-online-changed', 'hub:account']) {
      g.fake.events.dispatchEvent(new CustomEvent(ev, { detail: {} }));
      window.dispatchEvent(new CustomEvent(ev, { detail: {} }));
    }
    await g.frames(2);
    expect(g.hook.screen()).toBe('play');
  });
});

describe('joining others: Play now, With friends, a code', () => {
  /** A public room waiting in its lobby, hosted by player `host`. */
  const waiting = (code: string, host = 2, extra: Parameters<typeof fakeRoomInfo>[0] = {}) =>
    fakeRoomInfo({ id: `room-${code}`, code, hostId: host, public: true, seats: [fakeSeat(host)], ...extra });

  it('Play now joins a public room that is waiting, skipping full, started and own rooms', async () => {
    const g = await boot();
    g.fake.rooms.open = [
      waiting('FULLA', 2, { maxPlayers: 1 }),
      waiting('GAMEA', 3, { phase: 'playing' }),
      waiting('MINEA', 1),
      waiting('GONEA', 4),
      waiting('QWERT', 5),
    ];
    g.fake.rooms.full.add('GONEA');
    g.press('online');
    g.press('online-play-now');
    expect(g.ui.querySelector('[data-testid="looking"]')).not.toBeNull();
    await g.settle();
    expect(g.fake.log.calls.filter((c) => c.name === 'rooms.join').map((c) => c.args[0])).toEqual(['GONEA', 'QWERT']);
    expect(g.fake.log.count('rooms.create')).toBe(0);
    expect(g.hook.screen()).toBe('lobby');
    expect(g.ui.querySelector('[data-testid="looking"]')).toBeNull();
  });

  it('Play now with nobody waiting (or a hub without rooms.list) hosts a public room, public in presence', async () => {
    for (const listError of [false, true]) {
      const g = await boot();
      g.fake.rooms.listError = listError;
      g.press('online');
      g.press('online-play-now');
      await g.settle();
      expect(g.fake.log.last('rooms.create')?.args[0]).toMatchObject({ public: true });
      expect(g.hook.screen()).toBe('lobby');
      expect(g.fake.presence.current).toMatchObject({ kind: 'lobby', joinable: true, public: true });
    }
  });

  it('With friends hosts a private room (Invite in the lobby), as before', async () => {
    const g = await boot();
    g.press('online');
    g.press('online-friends');
    await g.settle();
    expect(g.fake.log.last('rooms.create')?.args[0]).not.toHaveProperty('public');
    expect(g.fake.presence.current).toMatchObject({ kind: 'lobby', public: false });
    g.press('lobby-invite');
    expect(g.fake.log.count('social.openInvite')).toBe(1);
  });

  it('Join with a code joins that room (any case); Back closes the chooser', async () => {
    const g = await boot();
    g.press('online');
    const input = g.ui.querySelector<HTMLInputElement>('[data-testid="join-code"]');
    if (!input) throw new Error('no join-code box');
    input.value = 'qwert';
    g.press('join-code-go');
    await g.settle();
    expect(g.fake.log.last('rooms.join')?.args).toEqual(['QWERT', false]);
    expect(g.hook.screen()).toBe('lobby');

    const h = await boot();
    h.press('online');
    h.press('online-who-back');
    expect(h.ui.querySelector('[data-testid="online-who"]')).toBeNull();
    expect(h.hook.screen()).toBe('title');
  });

  it('an invite taken while the chooser is open closes it: the lobby is not covered', async () => {
    const g = await boot();
    g.press('online');
    expect(g.ui.querySelector('[data-testid="online-who"]')).not.toBeNull();
    g.fake.mp.launch({ kind: 'join', room: 'INV1' });
    await g.settle();
    expect(g.hook.screen()).toBe('lobby');
    expect(g.ui.querySelector('[data-testid="online-who"]')).toBeNull();
  });
});

/** Let the browser's own tasks run (jsdom delivers a history back's popstate in a later task). */
const browserTasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('leaving a room', () => {
  it("Back in the lobby (the phone's or the browser's) leaves the room, not the page: no seat is held", async () => {
    const g = await boot({ patch: { backGuard: true } });
    await browserTasks(); // (an earlier test's guard may still be taking its entry off)
    g.press('online');
    g.press('online-friends');
    await g.settle();
    expect(g.hook.screen()).toBe('lobby');
    expect(history.state).toMatchObject({ kitBackGuard: true });
    history.back();
    await browserTasks();
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.fake.log.count('room.leave')).toBe(1);
    await browserTasks();
    expect(history.state).not.toMatchObject({ kitBackGuard: true });
  });

  it("the pad's B and Esc in the lobby leave the room too (an Esc while typing in the chat doesn't)", async () => {
    const g = await boot();
    g.press('online');
    g.press('online-friends');
    await g.settle();
    const chat = g.ui.querySelector<HTMLInputElement>('.kit-chat-input');
    chat?.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await g.settle();
    expect(g.hook.screen()).toBe('lobby');
    chat?.blur();
    g.fake.input.pressBack();
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.fake.log.count('room.leave')).toBe(1);
  });

  it('Leave in the lobby leaves the room with the hub', async () => {
    const g = await boot();
    g.press('online');
    g.press('online-friends');
    await g.settle();
    g.press('lobby-leave');
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.fake.log.count('room.leave')).toBe(1);
  });
});
