// @vitest-environment jsdom
// While the back guard is on (play), an edge swipe or a back gesture doesn't leave the game (src/kit/ui/back-guard.ts).
import { describe, expect, it } from 'vitest';
import {
  BACK_GUARD_CLASS,
  backGuard,
  CUSHIONS,
  cushionDepth,
  EDGE_PX,
  edgeSwipe,
  historyGuard,
  type GuardWindow,
  type PopEvent,
} from '../../../src/kit/ui/back-guard.ts';

const WIDTH = 400;
const PAGE = 'https://diffenderfer.games/my-game/';

/**
 * A browser's history for one page: pushState drops what's ahead, back is
 * asynchronous (the popstate comes later), and a back past the page's first
 * entry leaves the page (`left`). Capturing popstate listeners run first, and
 * one may stop the rest (the hub's guard, `hub` counts what it heard).
 */
function fakeWindow(url = PAGE) {
  const entries: { state: unknown; url: string }[] = [{ state: null, url }];
  let at = 0;
  let left = false;
  const listeners: { listener: (e: PopEvent) => void; capture: boolean }[] = [];
  let hub = 0;
  const pop = (): void => {
    let stopped = false;
    const e: PopEvent = {
      stopImmediatePropagation: () => {
        stopped = true;
      },
    };
    for (const l of [...listeners.filter((x) => x.capture), ...listeners.filter((x) => !x.capture)]) {
      if (stopped) return;
      l.listener(e);
    }
    if (!stopped) hub += 1;
  };
  const travel = (delta: number): void => {
    pending.push(() => {
      if (at + delta < 0) left = true;
      else {
        at += delta;
        pop();
      }
    });
  };
  const pending: (() => void)[] = [];
  const here = (): string => entries[at]?.url ?? url;
  const resolve = (u: string | URL | null | undefined): string => new URL(u ?? here(), here()).href;
  const win = {
    history: {
      get state(): unknown {
        return entries[at]?.state ?? null;
      },
      pushState(state: unknown, _unused: string, u?: string | URL | null): void {
        entries.splice(at + 1);
        entries.push({ state: structuredClone(state), url: resolve(u) });
        at += 1;
      },
      replaceState(state: unknown, _unused: string, u?: string | URL | null): void {
        entries[at] = { state: structuredClone(state), url: resolve(u) };
      },
      back(): void {
        travel(-1);
      },
      go(delta = 0): void {
        travel(delta);
      },
    },
    location: {
      get href(): string {
        return here();
      },
    },
    addEventListener(_type: 'popstate', listener: (e: PopEvent) => void, capture = false): void {
      listeners.push({ listener, capture });
    },
    setTimeout: (): number => 0,
    clearTimeout: (): void => {},
  } satisfies GuardWindow;
  const settle = (): void => {
    while (pending.length > 0) pending.shift()?.();
  };
  return {
    win,
    /** The browser gets round to the backs asked for. */
    settle,
    /** The player's back (a gesture or the button), as the browser does it. */
    back(): void {
      win.history.back();
      settle();
    },
    get length(): number {
      return entries.length;
    },
    get left(): boolean {
      return left;
    },
    /** Popstates the hub's guard (a bubbling listener after the kit's) would have heard. */
    get hub(): number {
      return hub;
    },
  };
}

/** Counts the guard's backs. */
const backs = () => {
  const b = { count: 0, onBack: () => {} };
  b.onBack = () => {
    b.count += 1;
  };
  return b;
};

/** A touchstart at x on el (jsdom has no Touch constructor: the list is a plain array). */
function touch(el: Element, x: number): Event {
  const e = new Event('touchstart', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(e, 'changedTouches', { value: [{ clientX: x, clientY: 200 }] });
  el.dispatchEvent(e);
  return e;
}

describe('edgeSwipe', () => {
  const canvas = document.createElement('canvas');
  it('cancels a touch that starts near either side', () => {
    expect(edgeSwipe([2], [canvas], WIDTH)).toBe(true);
    expect(edgeSwipe([EDGE_PX - 1], [canvas], WIDTH)).toBe(true);
    expect(edgeSwipe([WIDTH - 3], [canvas], WIDTH)).toBe(true);
  });
  it('leaves a touch away from the sides alone', () => {
    expect(edgeSwipe([EDGE_PX], [canvas], WIDTH)).toBe(false);
    expect(edgeSwipe([200], [canvas], WIDTH)).toBe(false);
    expect(edgeSwipe([WIDTH - EDGE_PX], [canvas], WIDTH)).toBe(false);
  });
  it('leaves a touch on a control alone, so its click still comes', () => {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    button.append(icon);
    expect(edgeSwipe([2], [icon, button, document.body], WIDTH)).toBe(false);
    const link = document.createElement('a');
    link.href = '#';
    expect(edgeSwipe([2], [link], WIDTH)).toBe(false);
    const role = document.createElement('div');
    role.setAttribute('role', 'button');
    expect(edgeSwipe([WIDTH - 1], [role], WIDTH)).toBe(false);
  });
});

describe('backGuard (touch)', () => {
  const setup = () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: WIDTH, configurable: true });
    document.body.innerHTML = '<div id="app"><canvas></canvas></div><button id="b">Pause</button>';
    return backGuard(document, fakeWindow().win);
  };
  const el = (sel: string): Element => {
    const found = document.querySelector(sel);
    if (!found) throw new Error(sel);
    return found;
  };

  it('cancels edge touches only while on, and marks the page', () => {
    const guard = setup();
    const canvas = el('canvas');
    expect(touch(canvas, 5).defaultPrevented).toBe(false);
    guard.start(backs().onBack);
    expect(document.documentElement.classList.contains(BACK_GUARD_CLASS)).toBe(true);
    expect(touch(canvas, 5).defaultPrevented).toBe(true);
    expect(touch(canvas, WIDTH - 5).defaultPrevented).toBe(true);
    expect(touch(canvas, 200).defaultPrevented).toBe(false);
    guard.stop();
    expect(document.documentElement.classList.contains(BACK_GUARD_CLASS)).toBe(false);
    expect(touch(canvas, 5).defaultPrevented).toBe(false);
  });

  it('a button at the side still gets its touch (and so its click)', () => {
    const guard = setup();
    guard.start(backs().onBack);
    expect(touch(el('#b'), 3).defaultPrevented).toBe(false);
    guard.stop();
  });

  it("a control inside a shadow root (the hub's menu button) is seen through it; the hub's stick is not a control", () => {
    const guard = setup();
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const toggle = document.createElement('button');
    const stick = document.createElement('div');
    root.append(toggle, stick);
    guard.start(backs().onBack);
    expect(touch(toggle, WIDTH - 2).defaultPrevented).toBe(false);
    expect(touch(stick, 2).defaultPrevented).toBe(true);
    guard.stop();
  });
});

describe('historyGuard', () => {
  it('pushes one entry however many times it turns on, and takes it off at the end', () => {
    const page = fakeWindow();
    const guard = historyGuard(page.win);
    guard.on(() => {});
    guard.on(() => {});
    expect(page.length).toBe(2);
    expect(page.win.history.state).toEqual({ kitBackGuard: true });
    guard.off();
    page.settle();
    expect(page.win.history.state).toBe(null);
    expect(guard.active).toBe(false);
    // play after play: never more than the one entry over the page's
    for (let i = 0; i < 5; i++) {
      guard.on(() => {});
      guard.off();
      page.settle();
    }
    guard.on(() => {});
    expect(page.length).toBe(2);
    expect(page.left).toBe(false);
  });

  it('a back while on stays on the page: the entry goes back on and onBack runs', () => {
    const page = fakeWindow();
    const guard = historyGuard(page.win);
    let backs = 0;
    guard.on(() => backs++);
    page.back();
    expect(backs).toBe(1);
    expect(page.win.history.state).toEqual({ kitBackGuard: true });
    page.back();
    page.back();
    expect(backs).toBe(3);
    expect(page.left).toBe(false);
    expect(page.length).toBe(2);
  });

  it("once off, Back is the page's own again: it leaves", () => {
    const page = fakeWindow();
    const guard = historyGuard(page.win);
    let backs = 0;
    guard.on(() => backs++);
    guard.off();
    page.settle();
    page.back();
    expect(backs).toBe(0);
    expect(page.left).toBe(true);
  });

  it('turning on while the last entry is coming off guards again', () => {
    const page = fakeWindow();
    const guard = historyGuard(page.win);
    let backs = 0;
    guard.on(() => backs++);
    guard.off();
    guard.on(() => backs++);
    page.settle();
    expect(guard.active).toBe(true);
    expect(page.win.history.state).toEqual({ kitBackGuard: true });
    expect(backs).toBe(0);
    page.back();
    expect(backs).toBe(1);
    expect(page.left).toBe(false);
  });

  it('keeps the address the hub tidied meanwhile', () => {
    const page = fakeWindow(`${PAGE}?mp=lobby&code=ABCD`);
    const guard = historyGuard(page.win);
    guard.on(() => {});
    page.win.history.replaceState(page.win.history.state, '', PAGE);
    guard.off();
    page.settle();
    expect(page.win.location.href).toBe(PAGE);
    expect(page.win.history.state).toBe(null);
  });

  it('keeps what the page had in its history state', () => {
    const page = fakeWindow();
    page.win.history.replaceState({ hub: 'x' }, '');
    const guard = historyGuard(page.win);
    guard.on(() => {});
    expect(page.win.history.state).toEqual({ hub: 'x', kitBackGuard: true });
    guard.off();
    page.settle();
    expect(page.win.history.state).toEqual({ hub: 'x' });
  });

  it("when the entry isn't the one showing, the end leaves the history alone", () => {
    const page = fakeWindow();
    const guard = historyGuard(page.win);
    guard.on(() => {});
    page.win.history.pushState({ other: 1 }, '');
    guard.off();
    page.settle();
    expect(page.win.history.state).toEqual({ other: 1 });
  });
});

describe('backGuard (history and options)', () => {
  it('every back calls onBack (the kit pauses on the first, the rest find it paused); stop takes the entry off', () => {
    const page = fakeWindow();
    const guard = backGuard(document, page.win);
    const b = backs();
    guard.start(b.onBack);
    page.back();
    page.back();
    expect(b.count).toBe(2);
    expect(page.win.history.state).toEqual({ kitBackGuard: true });
    guard.stop();
    page.settle();
    expect(page.win.history.state).toBe(null);
    expect(page.left).toBe(false);
  });

  it('options: no history entry, no edge cancelling, a wider edge', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: WIDTH, configurable: true });
    document.body.innerHTML = '<canvas></canvas>';
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('canvas');
    const page = fakeWindow();
    const noHistory = backGuard(document, page.win, { history: false, edgePx: 60 });
    noHistory.start(backs().onBack);
    expect(page.length).toBe(1);
    expect(touch(canvas, 50).defaultPrevented).toBe(true);
    noHistory.stop();
    const noEdges = backGuard(document, page.win, { edges: false });
    noEdges.start(backs().onBack);
    expect(touch(canvas, 2).defaultPrevented).toBe(false);
    expect(document.documentElement.classList.contains(BACK_GUARD_CLASS)).toBe(true);
    noEdges.stop();
    page.settle();
  });
});

describe('cushions and the CloseWatcher (Android Back skips entries pushed without a tap)', () => {
  const tap = (): void => {
    document.dispatchEvent(new Event('pointerup', { bubbles: true }));
  };

  it('each tap in play adds a cushion, up to CUSHIONS; a Back onto one does nothing and the hub never hears it', () => {
    const page = fakeWindow();
    const guard = backGuard(document, page.win);
    const b = backs();
    guard.start(b.onBack);
    for (let i = 0; i < CUSHIONS + 3; i++) tap();
    expect(page.length).toBe(2 + CUSHIONS);
    expect(cushionDepth(page.win.history.state)).toBe(CUSHIONS);
    const heard = page.hub;
    page.back();
    page.back();
    expect(b.count).toBe(0);
    expect(page.hub).toBe(heard);
    expect(cushionDepth(page.win.history.state)).toBe(CUSHIONS - 2);
    // the next tap tops it up again
    tap();
    expect(cushionDepth(page.win.history.state)).toBe(CUSHIONS - 1);
    guard.stop();
    page.settle();
  });

  it('a Back past every cushion still pauses and stays on the page', () => {
    const page = fakeWindow();
    const guard = backGuard(document, page.win);
    const b = backs();
    guard.start(b.onBack);
    tap();
    page.back();
    page.back();
    expect(b.count).toBe(1);
    expect(page.left).toBe(false);
    guard.stop();
    page.settle();
  });

  it('stop takes every entry off at once, so Back in the menus leaves', () => {
    const page = fakeWindow();
    page.win.history.replaceState({ hub: 'x' }, '');
    const guard = backGuard(document, page.win);
    guard.start(backs().onBack);
    tap();
    tap();
    guard.stop();
    page.settle();
    expect(page.win.history.state).toEqual({ hub: 'x' });
    tap();
    expect(page.win.history.state).toEqual({ hub: 'x' });
    page.back();
    expect(page.left).toBe(true);
  });

  it('a tap opens a CloseWatcher (one at a time); its close does nothing; stop destroys it', () => {
    const made: { onclose: (() => void) | null; destroyed: boolean; destroy(): void }[] = [];
    class FakeWatcher {
      onclose: (() => void) | null = null;
      destroyed = false;
      constructor() {
        made.push(this);
      }
      destroy(): void {
        this.destroyed = true;
      }
    }
    const page = fakeWindow();
    const win = { ...page.win, CloseWatcher: FakeWatcher };
    const guard = backGuard(document, win);
    const b = backs();
    guard.start(b.onBack);
    tap();
    tap();
    expect(made.length).toBe(1);
    made[0]?.onclose?.();
    expect(b.count).toBe(0);
    tap();
    expect(made.length).toBe(2);
    guard.stop();
    page.settle();
    expect(made[1]?.destroyed).toBe(true);
    tap();
    expect(made.length).toBe(2);
  });
});
