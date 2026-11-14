// @vitest-environment jsdom
// Local play (kit/local): the split-screen layout, the players, the controller and the join sheet.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  glViewport,
  LocalController,
  LOCAL_COLORS,
  mountViewLayers,
  NO_LOCAL,
  openJoin,
  playersOf,
  seatLimits,
  viewLayout,
  VIEW_GAP,
  type LocalPlayer,
} from '../../../src/kit/local/index.ts';
import { createFakeHub, type FakeHub, type FakeSeats } from '../../../src/kit/testing/index.ts';
import { PAD_BUTTON } from '@diffenderfer-games/hub/input';

describe('viewLayout', () => {
  it('one player has the whole screen', () => {
    expect(viewLayout(1, 800, 600)).toEqual({ views: [{ x: 0, y: 0, width: 800, height: 600 }], standings: null });
  });

  it('two sit side by side on a wide screen and stacked on a tall one', () => {
    const wide = viewLayout(2, 804, 600);
    expect(wide.views).toEqual([
      { x: 0, y: 0, width: 400, height: 600 },
      { x: 400 + VIEW_GAP, y: 0, width: 400, height: 600 },
    ]);
    const tall = viewLayout(2, 600, 804);
    expect(tall.views.map((v) => [v.y, v.height])).toEqual([
      [0, 400],
      [404, 400],
    ]);
    expect(wide.standings).toBeNull();
  });

  it('three play in a 2×2 grid with the standings in the fourth cell; four fill it', () => {
    const three = viewLayout(3, 804, 604);
    expect(three.views).toHaveLength(3);
    expect(three.standings).toEqual({ x: 404, y: 304, width: 400, height: 300 });
    const four = viewLayout(4, 804, 604);
    expect(four.views).toHaveLength(4);
    expect(four.standings).toBeNull();
  });

  it('clamps the count to 1..4', () => {
    expect(viewLayout(0, 100, 100).views).toHaveLength(1);
    expect(viewLayout(9, 100, 100).views).toHaveLength(4);
  });
});

describe('glViewport', () => {
  it('flips to a bottom-left origin and scales by the pixel ratio', () => {
    expect(glViewport({ x: 404, y: 0, width: 400, height: 300 }, 604, 2)).toEqual({
      x: 808,
      y: 608,
      width: 800,
      height: 600,
    });
    expect(glViewport({ x: 0, y: 304, width: 400, height: 300 }, 604)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });
});

describe('mountViewLayers', () => {
  it('puts a layer per player at its rect, with its size and colour, and the standings cell for three', () => {
    const parent = document.createElement('div');
    const players = [{ color: '#f00' }, { color: '#0f0' }, { color: '#00f' }];
    const layers = mountViewLayers(parent, players, { width: 804, height: 604 });
    const second = layers.view(1);
    expect(second?.style.left).toBe('404px');
    expect(second?.style.getPropertyValue('--view-w')).toBe('400px');
    expect(second?.style.getPropertyValue('--seat-color')).toBe('#0f0');
    expect(layers.standings?.style.top).toBe('304px');
    expect(layers.view(3)).toBeNull();
    expect(second?.dataset['prompts']).toBeUndefined();
    const devices = mountViewLayers(
      parent,
      [
        { color: '#f00', device: 'pad', padStyle: 'ps' },
        { color: '#0f0', device: 'keyboard' },
      ],
      { width: 800, height: 600 },
    );
    expect([devices.view(0)?.dataset['prompts'], devices.view(0)?.dataset['padStyle']]).toEqual(['pad', 'ps']);
    expect([devices.view(1)?.dataset['prompts'], devices.view(1)?.dataset['padStyle']]).toEqual(['keys', undefined]);
    devices.remove();
    layers.layout(604, 804);
    expect(layers.view(1)?.style.left).toBe('304px');
    layers.remove();
    expect(parent.children).toHaveLength(0);
  });
});

describe('seats and players', () => {
  it('limits max to 2..4 and min to 2..max', () => {
    expect(seatLimits({})).toEqual({ min: 2, max: 4 });
    expect(seatLimits({ max: 9, min: 1 })).toEqual({ min: 2, max: 4 });
    expect(seatLimits({ max: 3, min: 5 })).toEqual({ min: 3, max: 3 });
  });

  it('names and colours players in seat order; seat 0 is you; pads get their glyph style', () => {
    const players = playersOf(
      [
        { index: 0, device: { kind: 'keyboard' }, connected: true },
        {
          index: 1,
          device: { kind: 'pad', pad: 2, id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)' },
          connected: true,
        },
      ],
      {},
      (n) => `Player ${n}`,
    );
    expect(players).toEqual([
      { seat: 0, name: 'Player 1', color: LOCAL_COLORS[0], me: true, device: 'keyboard', padStyle: null },
      { seat: 1, name: 'Player 2', color: LOCAL_COLORS[1], me: false, device: 'pad', padStyle: 'ps' },
    ]);
  });

  it('a page without local play reads nothing', () => {
    expect(NO_LOCAL.available).toBe(false);
    expect(NO_LOCAL.input(0).vector('move')).toEqual({ x: 0, y: 0, mag: 0 });
  });
});

let fake: FakeHub;
let seats: FakeSeats;
let lost: LocalPlayer[];
let vibration: boolean;

function controller(spec: { max?: number; min?: number } | undefined): LocalController {
  return new LocalController({
    hub: fake,
    spec,
    name: (n) => `Player ${n}`,
    vibration: () => vibration,
    onLost: (p) => lost.push(p),
    onFound: () => undefined,
  });
}

beforeEach(() => {
  fake = createFakeHub({ events: new EventTarget() });
  seats = fake.input.enableSeats();
  lost = [];
  vibration = true;
});

afterEach(() => {
  // Close a sheet a failed test left open (the kit UI root stays on the page).
  for (const sheet of document.querySelectorAll('[data-testid="join-sheet"]')) sheet.remove();
});

describe('LocalController', () => {
  it('is available only with seats in the client, a declared spec, and not on a touch-only device', () => {
    expect(controller({}).available).toBe(true);
    expect(controller(undefined).available).toBe(false);
    fake.input.touchDevice = true;
    expect(controller({}).available).toBe(false);
    fake.input.touchDevice = false;
    delete fake.input.seats;
    expect(controller({}).available).toBe(false);
  });

  it('starts the joined players, reads each seat, rumbles only with vibration on, and closes the seats', () => {
    const local = controller({ max: 3 });
    expect(local.open()).toBe(seats);
    expect(seats.options).toEqual({ max: 3, keyboard: true });
    seats.joining(true);
    seats.join();
    seats.join({ kind: 'keyboard' });
    const players = local.start();
    expect(players.map((p) => p.name)).toEqual(['Player 1', 'Player 2']);
    expect(seats.isJoining).toBe(false);
    expect(local.active).toBe(true);
    seats.hold(1, 'boost');
    expect(local.input(1).pressed('boost')).toBe(true);
    expect(local.input(0).pressed('boost')).toBe(false);
    expect(local.input(3).pressed('boost')).toBe(false);
    local.haptic(0, true);
    vibration = false;
    local.haptic(1);
    expect(seats.rumbles).toEqual([{ seat: 0, effect: { strength: 0.9, ms: 180 } }]);
    seats.plug(1, false);
    expect(lost.map((p) => p.name)).toEqual(['Player 2']);
    expect(local.connected(1)).toBe(false);
    local.close();
    expect(seats.closed).toBe(true);
    expect(local.active).toBe(false);
    expect(local.players).toEqual([]);
  });
});

describe('openJoin', () => {
  function key(k: string): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  }

  it('shows a slot per seat; Start begins once enough have joined', async () => {
    const local = controller({ max: 4, min: 2 });
    const joined = openJoin({ hub: fake, local });
    expect(seats.isJoining).toBe(true);
    const slots = document.querySelectorAll('[data-testid^="join-slot-"]');
    expect(slots).toHaveLength(4);
    const start = document.querySelector<HTMLButtonElement>('[data-testid="join-start"]');
    expect(start?.disabled).toBe(true);
    seats.join();
    expect(document.querySelector('[data-testid="join-slot-0"]')?.getAttribute('data-state')).toBe('joined');
    start?.click();
    expect(document.querySelector('[data-testid="join-sheet"]')).not.toBeNull();
    seats.join({ kind: 'keyboard' });
    expect(start?.disabled).toBe(false);
    document.querySelector<HTMLButtonElement>('[data-testid="join-start"]')?.click();
    await expect(joined).resolves.toBe(true);
    expect(document.querySelector('[data-testid="join-sheet"]')).toBeNull();
    expect(seats.closed).toBe(false);
  });

  it('Back and Start show their presses; B only while nobody is seated', async () => {
    const local = controller({});
    const joined = openJoin({ hub: fake, local });
    const chipOf = (id: string): HTMLElement | null =>
      document.querySelector<HTMLElement>(`[data-testid="${id}"] > .kit-glyph-on`);
    expect(chipOf('join-start')?.querySelector('.kit-g-keys')?.textContent).toBe('Enter');
    expect(chipOf('join-start')?.querySelector('.kit-g-xbox')?.textContent).toBe('Menu');
    expect(chipOf('join-back')?.querySelector('.kit-g-keys')?.textContent).toBe('Esc');
    expect(chipOf('join-back')?.dataset['pad']).toBe('yes');
    seats.join();
    expect(chipOf('join-back')?.dataset['pad']).toBe('no');
    key('Escape');
    await expect(joined).resolves.toBe(false);
  });

  it("Esc cancels and releases the seats (and is the sheet's, not the world box's)", async () => {
    const local = controller({});
    const joined = openJoin({ hub: fake, local });
    seats.join();
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    await expect(joined).resolves.toBe(false);
    expect(seats.closed).toBe(true);
  });

  it('the keyboard player leaves with Backspace and starts with Enter', async () => {
    const local = controller({});
    const joined = openJoin({ hub: fake, local });
    seats.join({ kind: 'keyboard' });
    key('Backspace');
    expect(seats.count).toBe(0);
    expect(document.querySelector('[data-testid="join-sheet"]')).not.toBeNull();
    seats.join({ kind: 'keyboard' });
    key('Enter'); // only one player: not yet
    expect(document.querySelector('[data-testid="join-sheet"]')).not.toBeNull();
    seats.join();
    key('Enter');
    await expect(joined).resolves.toBe(true);
  });

  it('a seated pad leaves with B and starts with Start', async () => {
    const local = controller({});
    const joined = openJoin({ hub: fake, local });
    seats.join();
    seats.join();
    seats.padPress(1, PAD_BUTTON.B);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    expect(seats.count).toBe(1);
    seats.endFrame();
    seats.join();
    seats.padPress(0, PAD_BUTTON.START);
    await expect(joined).resolves.toBe(true);
  });

  it("a host element holds the sheet (data-hosted, filling it) and its presses stay the sheet's", async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const local = controller({});
    const joined = openJoin({ hub: fake, local, host });
    const sheet = host.querySelector<HTMLElement>('[data-testid="join-sheet"]');
    expect(sheet?.dataset['hosted']).toBe('true');
    expect(sheet?.hasAttribute('data-modal')).toBe(true);
    seats.join();
    key('Escape');
    await expect(joined).resolves.toBe(false);
    expect(host.children).toHaveLength(0);
    expect(seats.closed).toBe(true);
    host.remove();
  });

  it('a signal closes it as Back does; an aborted one never opens', async () => {
    const local = controller({});
    const stop = new AbortController();
    const joined = openJoin({ hub: fake, local, signal: stop.signal });
    seats.join();
    stop.abort();
    await expect(joined).resolves.toBe(false);
    expect(document.querySelector('[data-testid="join-sheet"]')).toBeNull();
    expect(seats.closed).toBe(true);
    await expect(openJoin({ hub: fake, local, signal: stop.signal })).resolves.toBe(false);
    expect(document.querySelector('[data-testid="join-sheet"]')).toBeNull();
  });

  it('keep: the seats a stopped local game holds open again, players and all', async () => {
    const local = controller({});
    local.open();
    seats.joining(true);
    seats.join();
    seats.join({ kind: 'keyboard' });
    local.start();
    local.hold();
    expect(local.active).toBe(false);
    expect(seats.closed).toBe(false);
    const joined = openJoin({ hub: fake, local, keep: true });
    expect(seats.count).toBe(2);
    expect(seats.isJoining).toBe(true);
    expect(document.querySelector('[data-testid="join-slot-1"]')?.getAttribute('data-state')).toBe('joined');
    document.querySelector<HTMLButtonElement>('[data-testid="join-start"]')?.click();
    await expect(joined).resolves.toBe(true);
    // (without keep, the sheet opens fresh)
    local.hold();
    const fresh = openJoin({ hub: fake, local });
    expect(seats.count).toBe(0);
    key('Escape');
    await expect(fresh).resolves.toBe(false);
  });

  it("the last seated pad's B only gives its seat up; the next B with nobody seated cancels", async () => {
    const local = controller({});
    const joined = openJoin({ hub: fake, local });
    let result: boolean | null = null;
    void joined.then((go) => (result = go));
    seats.join();
    seats.padPress(0, PAD_BUTTON.B);
    const pad = { index: 0, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === PAD_BUTTON.B })) };
    const had = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    expect(seats.count).toBe(0);
    expect(result).toBeNull();
    seats.endFrame();
    pad.buttons[PAD_BUTTON.B] = { pressed: false };
    await new Promise((r) => requestAnimationFrame(r));
    pad.buttons[PAD_BUTTON.B] = { pressed: true };
    await expect(joined).resolves.toBe(false);
    if (had) Object.defineProperty(navigator, 'getGamepads', had);
    else Reflect.deleteProperty(navigator, 'getGamepads');
  });

  it('resolves false at once where the client has no seats', async () => {
    delete fake.input.seats;
    await expect(openJoin({ hub: fake, local: controller({}) })).resolves.toBe(false);
  });
});
