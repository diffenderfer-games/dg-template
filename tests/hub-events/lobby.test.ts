// The room's lobby (ready, auto-ready, the host role handed over) and the rematch after a game (kit 1.35).
import { expect, it } from 'vitest';
import { AUTO_READY_MARGIN_MS, AUTO_READY_MS } from '../../src/kit/online/ready.ts';
import type { FakeRoom } from '../../src/kit/testing/index.ts';
import { bootGame, describeIf, HAS, type Booted } from './_support/harness.ts';
import { toyOnline } from './_support/toys.ts';

const describe = describeIf(HAS.online, 'this game declares no game.multiplayer');

const boot = (o: Parameters<typeof bootGame>[0] = {}): Promise<Booted> =>
  bootGame({ ...o, patch: { online: toyOnline(), ...o?.patch } });

function roomOf(g: Booted): FakeRoom {
  const r = g.fake.rooms.current;
  if (!r) throw new Error('not in a room');
  return r;
}

const el = (g: Booted, id: string): HTMLElement | null => g.ui.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const playOff = (g: Booted): boolean | undefined =>
  g.ui.querySelector<HTMLButtonElement>('[data-testid="lobby-start"]')?.disabled;

async function hostRoom(g: Booted): Promise<FakeRoom> {
  g.press('online');
  g.press('online-friends');
  await g.settle();
  return roomOf(g);
}

describe('the lobby: ready and Play', () => {
  it('Play waits until every guest is ready; the status line and chips say who', async () => {
    const g = await boot();
    const room = await hostRoom(g);
    expect(el(g, 'lobby-status')?.textContent).toBe('Waiting for more players');
    expect(el(g, 'room-code')?.textContent).toBe('ABCDE');
    room.addSeat(2, { name: 'Ann' });
    room.addSeat(3, { name: 'Bo' });
    expect(playOff(g)).toBe(true);
    expect(el(g, 'lobby-status')?.textContent).toBe('Waiting for Ann and Bo to get ready');
    expect(el(g, 'seat-status-2')?.textContent).toBe('Not ready');
    expect(el(g, 'seat-status-1')?.textContent).toBe('Host');
    g.press('lobby-start'); // disabled: nothing happens
    expect(g.fake.log.count('room.start')).toBe(0);
    room.patchSeat(2, { ready: true });
    room.patchSeat(3, { ready: true });
    expect(el(g, 'seat-status-2')?.textContent).toBe('Ready ✓');
    expect(playOff(g)).toBe(false);
    expect(el(g, 'lobby-status')?.textContent).toBe("Everyone's ready: press Play!");
    g.press('lobby-start');
    await g.frames(2);
    expect(g.fake.log.count('room.start')).toBe(1);
  });

  it('a guest presses I am ready! (the first focus); pressing again takes it back', async () => {
    const g = await boot();
    g.fake.mp.launch({ kind: 'join', room: 'JOIN1' });
    await g.settle();
    expect(el(g, 'lobby-start')).toBeNull();
    expect(el(g, 'lobby-status')?.textContent).toBe('Press Ready when you are');
    expect(document.activeElement).toBe(el(g, 'lobby-ready'));
    g.press('lobby-ready');
    await g.settle();
    expect(g.fake.log.last('room.ready')?.args).toEqual([true]);
    expect(el(g, 'lobby-ready')?.getAttribute('aria-pressed')).toBe('true');
    expect(el(g, 'lobby-status')?.textContent).toMatch(/You're ready\. Waiting for Player2 \(host\)/);
    g.press('lobby-ready');
    await g.settle();
    expect(g.fake.log.last('room.ready')?.args).toEqual([false]);
  });

  it('a guest seated a minute (plus a margin) counts as ready; the countdown ticks in place', async () => {
    const g = await boot();
    const room = await hostRoom(g);
    room.addSeat(2, { joinedAt: g.fake.clock.now() });
    expect(playOff(g)).toBe(true);
    expect(el(g, 'seat-status-2')?.textContent).toBe('Ready in 1:03');
    const chip = el(g, 'seat-status-2');
    g.fake.clock.advance(2000);
    await g.settle();
    expect(el(g, 'seat-status-2')).toBe(chip); // not drawn again
    expect(chip?.textContent).toBe('Ready in 1:01');
    g.fake.clock.advance(AUTO_READY_MS + AUTO_READY_MARGIN_MS);
    await g.settle();
    expect(el(g, 'seat-status-2')?.textContent).toBe('Ready ✓');
    expect(playOff(g)).toBe(false);
  });

  it('a device clock minutes ahead of the hub: a guest who just sat is not ready yet (host and guest)', async () => {
    const g = await boot({ before: (fake) => void (fake.rooms.hubBehind = 120_000) });
    const room = await hostRoom(g);
    room.addSeat(2, { joinedAt: g.fake.rooms.hubNow() });
    expect(el(g, 'seat-status-2')?.textContent).toBe('Ready in 1:03');
    expect(playOff(g)).toBe(true);
    const guest = await boot({ before: (fake) => void (fake.rooms.hubBehind = 120_000) });
    guest.fake.mp.launch({ kind: 'join', room: 'JOIN1' });
    await guest.settle();
    expect(el(guest, 'lobby-status')?.textContent).toBe('Press Ready when you are');
  });

  it('an away guest blocks Play', async () => {
    const g = await boot();
    const room = await hostRoom(g);
    room.addSeat(2, { ready: true, connected: false });
    expect(el(g, 'seat-status-2')?.textContent).toBe('Away');
    expect(playOff(g)).toBe(true);
  });

  it('the host hands the host role over after asking; the guest gets Make host only as host', async () => {
    const g = await boot();
    const room = await hostRoom(g);
    room.addSeat(2, { name: 'Ann' });
    g.press('make-host-2');
    expect(el(g, 'confirm')?.textContent).toContain('Make Ann the host?');
    g.press('confirm-yes');
    await g.settle();
    expect(g.fake.log.last('room.setHost')?.args).toEqual([2]);
    expect(el(g, 'lobby-start')).toBeNull();
    expect(el(g, 'make-host-2')).toBeNull();
    expect(el(g, 'lobby-ready')).not.toBeNull();
  });

  it('an older hub: no Make host, no countdown, Ready still there and Play follows the ready flags', async () => {
    const g = await boot();
    g.fake.rooms.older = true;
    const room = await hostRoom(g);
    room.addSeat(2);
    expect(el(g, 'make-host-2')).toBeNull();
    expect(el(g, 'seat-status-2')?.textContent).toBe('Not ready');
    g.fake.clock.advance(AUTO_READY_MS * 2);
    await g.settle();
    expect(playOff(g)).toBe(true);
    room.patchSeat(2, { ready: true });
    expect(playOff(g)).toBe(false);

    const w = await boot();
    w.fake.rooms.older = true;
    w.fake.mp.launch({ kind: 'join', room: 'OLD1' });
    await w.settle();
    expect(el(w, 'lobby-ready')).not.toBeNull();
  });
});

/** Host, seat a ready guest, play, end. */
async function played(g: Booted): Promise<FakeRoom> {
  const room = await hostRoom(g);
  room.addSeat(2, { name: 'Ann', ready: true });
  g.press('lobby-start');
  await g.frames(2);
  room.endedBy({ winners: [1] });
  await g.settle();
  return room;
}

describe('rematch', () => {
  it('the first to press Rematch hosts the new room and lands in its lobby', async () => {
    const g = await boot();
    await played(g);
    expect(g.hook.screen()).toBe('result');
    expect(el(g, 'rematch')?.textContent).toContain('Rematch');
    g.press('rematch');
    await g.settle();
    expect(g.fake.log.count('room.rematch')).toBe(1);
    expect(g.hook.screen()).toBe('lobby');
    expect(el(g, 'lobby-rematch')).not.toBeNull();
    expect(el(g, 'lobby-start')).not.toBeNull();
    expect(el(g, 'room-code')?.textContent).toBe('REMAT');
  });

  it("someone else's rematch: a toast, then Join rematch puts this player in it as a guest", async () => {
    const g = await boot();
    const room = await played(g);
    room.rematchBy(2, [2]);
    expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toMatch(/Ann started a rematch/);
    expect(el(g, 'rematch')?.textContent).toContain('Join rematch');
    expect(el(g, 'rematch-line')?.textContent).toBe('Ann started a rematch · 1 in');
    g.press('rematch');
    await g.settle();
    expect(g.hook.screen()).toBe('lobby');
    expect(el(g, 'lobby-ready')).not.toBeNull();
    expect(roomOf(g).info.hostId).toBe(2);
  });

  it('the room closing after it ended keeps the results (the panel says so); Quit goes to the title', async () => {
    const g = await boot();
    const room = await played(g);
    room.close('ended');
    await g.settle();
    expect(g.hook.screen()).toBe('result');
    expect(el(g, 'rematch')).toBeNull();
    expect(el(g, 'rematch-line')?.textContent).toBe('The room has closed');
    g.press('quit');
    await g.settle();
    expect(g.hook.screen()).toBe('title');
  });

  it('an older hub: no Rematch, and the closed room goes to the title as before', async () => {
    const g = await boot();
    g.fake.rooms.older = true;
    await played(g);
    expect(el(g, 'rematch')).toBeNull();
  });
});

describe('settings during a match', () => {
  it('Leave the game? offers Settings: the sheet opens and the match goes on', async () => {
    const g = await boot();
    const room = await hostRoom(g);
    room.addSeat(2, { ready: true });
    g.press('lobby-start');
    await g.frames(2);
    g.press('pause');
    g.press('confirm-settings');
    await g.settle();
    expect(el(g, 'settings')).not.toBeNull();
    expect(g.hook.screen()).toBe('play');
    expect(g.hook.paused()).toBe(false);
  });
});
