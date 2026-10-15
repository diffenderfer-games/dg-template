// Appendix B rows 34–55: launches, rooms, seats, chat, social, presence, the runtime.
import { describe, expect, it } from 'vitest';
import { envelope } from '../../src/kit/online/wire.ts';
import type { FakeRoom } from '../../src/kit/testing/index.ts';
import { bootGame, type Booted } from './_support/harness.ts';

/** The fake room the player is in. */
function roomOf(g: Booted): FakeRoom {
  const r = g.fake.rooms.current;
  if (!r) throw new Error('not in a room');
  return r;
}

/** Host a room from the title, seat a second player, start. */
async function hostAndStart(g: Booted): Promise<FakeRoom> {
  g.press('online');
  await g.settle();
  const room = roomOf(g);
  room.addSeat(2);
  g.press('lobby-start');
  await g.frames(2);
  return room;
}

describe('launches (multiplayer.md §6)', () => {
  it('row 34: host: onLaunch is registered at boot before any await; the room is created once, for the party', async () => {
    const g = await bootGame();
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
    const g = await bootGame();
    g.fake.mp.launch({ kind: 'guest', partyId: 'p1', joinInfo: { room: 'ROOM1' } });
    await g.settle();
    expect(g.fake.log.last('rooms.join')?.args[0]).toBe('ROOM1');

    const w = await bootGame();
    w.fake.mp.launch({ kind: 'guest', partyId: 'p2' });
    await w.settle();
    expect(w.fake.log.count('rooms.join')).toBe(0);
    w.fake.mp.joinInfo('p2', { room: 'ROOM2' });
    await w.settle();
    expect(w.fake.log.last('rooms.join')?.args[0]).toBe('ROOM2');
  });

  it('row 36: join (also via an invite link or a rejoin) joins launch.room', async () => {
    for (const via of [undefined, 'link', 'rejoin'] as const) {
      const g = await bootGame();
      g.fake.mp.launch(via === undefined ? { kind: 'join', room: 'JOIN1' } : { kind: 'join', room: 'JOIN1', via });
      await g.settle();
      expect(g.fake.log.last('rooms.join')?.args, String(via)).toEqual(['JOIN1', false]);
    }
  });

  it('row 37: watch joins as a spectator and sends no input', async () => {
    const g = await bootGame();
    g.fake.mp.launch({ kind: 'watch', room: 'W1' });
    await g.settle();
    expect(g.fake.log.last('rooms.join')?.args).toEqual(['W1', true]);
    const room = roomOf(g);
    room.receive(1, envelope('view', { players: [], coin: { x: 1, y: 1 }, target: 3, winner: null }, 1));
    await g.frames(30);
    expect(room.sent).toHaveLength(0);
  });

  it('row 38: a tournament match offers no "Play again"', async () => {
    const g = await bootGame();
    g.fake.mp.launch({ kind: 'host', partyId: 't1', tournament: { id: 1, title: 'Cup', match: 'm1', opponent: null } });
    await g.settle();
    const room = roomOf(g);
    room.addSeat(2);
    g.press('lobby-start');
    room.endedBy({ winners: [1] });
    expect(g.hook.screen()).toBe('result');
    expect(g.ui.querySelector('[data-testid="play-again"]')).toBeNull();
  });

  it("row 39: a race launch is the hub's (it joins the race itself)", async () => {
    const g = await bootGame();
    g.fake.mp.launch({ kind: 'guest', mode: 'race', partyId: 'r', joinInfo: { room: 'R' } });
    await g.settle();
    expect(g.fake.log.count('rooms.join')).toBe(0);
  });

  it('row 40: a launch before mount waits, is handled once, and wins over the title', async () => {
    const g = await bootGame({ before: (f) => f.mp.launch({ kind: 'join', room: 'EARLY' }) });
    expect(g.fake.log.named('rooms.join')).toHaveLength(1);
    expect(g.hook.screen()).toBe('lobby');
    expect(g.calls.count('screen.title')).toBe(0);
  });
});

describe('rooms (multiplayer.md §8)', () => {
  it('row 42: when the host role moves here, the freshest backup takes over and play goes on', async () => {
    const g = await bootGame();
    g.fake.mp.launch({ kind: 'join', room: 'H1' });
    await g.settle();
    const room = roomOf(g);
    const state = (score: number) => ({
      rng: 1,
      players: [
        { id: 1, x: 100, y: 100, score: 0, dx: 0, dy: 0 },
        { id: 2, x: 300, y: 300, score, dx: 0, dy: 0 },
      ],
      coin: { x: 800, y: 500 },
      target: 10,
      winner: null,
    });
    room.receive(2, envelope('view', { players: [], coin: { x: 1, y: 1 }, target: 10, winner: null }, 1));
    room.receive(2, envelope('backup', state(1), 10));
    room.receive(2, envelope('backup', state(4), 20));
    room.setInfo({ hostId: 1 });
    await g.frames(10);
    const views = room.sent.filter((m) => JSON.stringify(m.data).includes('"view"'));
    expect(views.length).toBeGreaterThan(0);
    expect(JSON.stringify(views.at(-1)?.data)).toContain('"score":4');
  });

  it('row 43: invalid messages are dropped; valid views are drawn', async () => {
    const g = await bootGame();
    g.fake.mp.launch({ kind: 'join', room: 'V' });
    await g.settle();
    const room = roomOf(g);
    room.receive(1, { v: 99, t: 'view', d: {}, at: 0 });
    room.receive(1, envelope('view', { nope: true }, 1));
    expect(g.hook.screen()).toBe('lobby');
    room.receive(1, envelope('view', { players: [], coin: { x: 1, y: 1 }, target: 3, winner: null }, 2));
    expect(g.hook.screen()).toBe('play');
  });

  it('row 44: an away or gone seat is played by the computer and handed back without a reset', async () => {
    const g = await bootGame();
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
    const g = await bootGame();
    const room = await hostAndStart(g);
    room.seatChange(2, 'gone');
    await g.frames(10);
    expect(g.hook.screen()).toBe('play');
  });

  it('row 46: kicked: back to the title with a message', async () => {
    const g = await bootGame();
    g.fake.mp.launch({ kind: 'join', room: 'K' });
    await g.settle();
    roomOf(g).kicked();
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toMatch(/removed you/);
  });

  it('row 47: ended is handled once; online play writes no normal board', async () => {
    const g = await bootGame();
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
      const g = await bootGame();
      g.fake.mp.launch({ kind: 'join', room: 'C' });
      await g.settle();
      roomOf(g).close(reason);
      await g.settle();
      expect(g.ui.querySelector('[data-testid="toast"]')?.textContent, reason).toMatch(words);
    }
  });

  it('row 51: room errors become friendly words and a safe screen', async () => {
    const g = await bootGame();
    g.fake.rooms.joinError = 'room_full';
    g.fake.mp.launch({ kind: 'join', room: 'FULL' });
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toBe('That game is full.');
  });
});

describe('chat, social, presence, the runtime', () => {
  it('row 49: delivered text is shown as text; a softened line says so; a rejected one keeps the draft and the hint', async () => {
    const g = await bootGame();
    g.press('online');
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
      const g = await bootGame();
      g.press('online');
      await g.settle();
      g.fake.rooms.current?.setInfo({ chatMode: mode });
      const chat = g.ui.querySelector<HTMLElement>('[data-testid="chat"]');
      expect(chat?.hidden, mode).toBe(hidden);
      expect(g.ui.querySelector('[data-testid="chat-input"]') !== null, mode).toBe(box);
      expect(g.ui.querySelector('[data-testid="quick-gg"]') !== null, mode).toBe(chips);
    }
  });

  it('row 52: social events update nothing that pauses the game', async () => {
    const g = await bootGame();
    await g.start();
    g.fake.social.emit('counts', { online: 3, inGame: 1, friendsOnline: 1 });
    g.fake.social.emit('party', null);
    expect(g.hook.paused()).toBe(false);
  });

  it('row 53: presence per screen (coalesced), busy during the match, quiet during play', async () => {
    const g = await bootGame();
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
    const g = await bootGame();
    g.fake.runtime(false);
    await g.settle();
    expect(g.ui.querySelector<HTMLButtonElement>('[data-testid="online"]')?.disabled).toBe(true);
    g.fake.runtime(true);
    await g.settle();
    expect(g.ui.querySelector<HTMLButtonElement>('[data-testid="online"]')?.disabled).toBe(false);
  });

  it('row 55: pass-through hub events (changes-seen, prefetch, play-online-changed, account) change nothing', async () => {
    const g = await bootGame();
    await g.start();
    for (const ev of ['hub:changes-seen', 'hub:prefetch', 'hub:play-online-changed', 'hub:account']) {
      g.fake.events.dispatchEvent(new CustomEvent(ev, { detail: {} }));
      window.dispatchEvent(new CustomEvent(ev, { detail: {} }));
    }
    await g.frames(2);
    expect(g.hook.screen()).toBe('play');
  });
});
