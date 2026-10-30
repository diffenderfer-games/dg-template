/**
 * kit/ui: the back guard. While it is on (the kit turns it on for play), a swipe from the screen's
 * side or the phone's back gesture doesn't leave the game.
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "The back guard"
 *
 * - `html.kit-back-guard` (KIT_CSS): `touch-action: none` on the stage and the play screen, no
 *   overscroll, so a drag plays instead of scrolling or swiping.
 * - A touch that starts within `edgePx` of the left or right side, not on a control, has its
 *   `touchstart` cancelled (iOS Safari's swipe back/forward). A control (a button, the hub's) is
 *   left alone: cancelling its touchstart would cancel its click too.
 * - Android's Back (the edge swipe, the button) can't be cancelled, and Chrome's Back skips every
 *   history entry a page added without a tap in between. So the player's own taps and keys build
 *   the guard: each one opens a `CloseWatcher` (Chrome's Back closes it instead of navigating) and
 *   adds a cushion entry (up to `CUSHIONS`) over the guard's own. A Back caught by either does
 *   nothing at all: a stray swipe mid-stroke must not interrupt play (the pause button is there).
 *   A cushion's popstate is stopped before the hub's own guard sees it (the guard's listener is added as the game
 *   boots, before the hub's menu script adds its own).
 * - Under those, one history entry is pushed (once) on top of the page's: a Back that gets that
 *   far lands on the page's own entry instead of leaving; the entry goes back on and `onBack`
 *   runs (the kit's pause, which asks "Leave race?" / "Leave match?" where a game can't pause).
 * - When the guard turns off, its entries come off again (keeping an address the hub tidied
 *   meanwhile), so Back in the menus leaves as it always did.
 * - `?navlog=1` on the address lists what happened, on screen (kept across a reload), for a phone.
 */

import { realClock } from '../core/clock.ts';

/** How close to the left or right side (CSS px) a touch starts an edge swipe, by default. */
export const EDGE_PX = 24;

/** `<html>`'s class while the guard is on. */
export const BACK_GUARD_CLASS = 'kit-back-guard';

/** The most cushion entries the player's taps add over the guard's own. */
export const CUSHIONS = 4;

/** What a touch on these must still do (tap, click, focus). */
const CONTROLS = 'button, a[href], input, select, textarea, label, summary, [role="button"], [contenteditable="true"]';

/** Marks the history entries the guard pushed. */
const MARK = 'kitBackGuard';
/** A cushion entry's depth over the guard's own (absent on that one). */
const DEPTH = 'kitBackDepth';

/** A back that never comes back (a frame that ignores it) stops waiting after this. */
const POP_WAIT_MS = 1500;

/** Should this touch's start be cancelled: near a side, and not on a control? */
export function edgeSwipe(
  xs: readonly number[],
  path: readonly EventTarget[],
  width: number,
  edgePx = EDGE_PX,
): boolean {
  if (!xs.some((x) => x < edgePx || x > width - edgePx)) return false;
  return !path.some((t) => t instanceof Element && t.matches(CONTROLS));
}

/** What a popstate listener may do: keep the other listeners (the hub's guard) from hearing it. */
export type PopEvent = { stopImmediatePropagation(): void };

/** The window's parts the history guard uses (the page's `window`; a fake in tests). */
export type GuardWindow = {
  readonly history: Pick<History, 'state' | 'pushState' | 'replaceState' | 'back' | 'go'>;
  readonly location: { readonly href: string };
  addEventListener(type: 'popstate', listener: (e: PopEvent) => void, capture?: boolean): void;
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(id: number): void;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ours = (state: unknown): boolean => isObject(state) && state[MARK] === true;

/** How many cushions sit under this entry: 0 on the guard's own, -1 off the guard's entries. */
export function cushionDepth(state: unknown): number {
  if (!ours(state) || !isObject(state)) return -1;
  const n = state[DEPTH];
  return typeof n === 'number' ? n : 0;
}

/** The history guard alone: what keeps a back on the page (see the top). */
export type HistoryGuard = {
  readonly active: boolean;
  /** Push the entry (once, however many times it is called); a back then calls `onBack`. */
  on(onBack: () => void): void;
  /** One more cushion entry, if there's room: call it inside the player's tap or key. */
  cushion(): void;
  /** Take the entries off (only if they're still the ones showing). */
  off(): void;
};

/** The history entries that keep a back on the page (see the top). */
export function historyGuard(win: GuardWindow, log: (line: string) => void = () => undefined): HistoryGuard {
  let active = false;
  let back: () => void = () => undefined;
  /** The guard's own back is under way (its popstate is not the player's). */
  let popping = false;
  let popTimer = 0;
  /** The address when the guard came off (the hub may tidy it meanwhile). */
  let leftAt = '';

  const push = (extra: Record<string, unknown> = {}): void => {
    const state: unknown = win.history.state;
    try {
      win.history.pushState({ ...(isObject(state) ? state : {}), [MARK]: true, ...extra }, '', win.location.href);
    } catch {
      // (a sandboxed frame may refuse; the touch guard still works)
    }
  };

  /** The guard's own back arrived (or never will): keep the tidied address, and push again if it turned on meanwhile. */
  const popped = (): void => {
    if (!popping) return;
    popping = false;
    win.clearTimeout(popTimer);
    if (leftAt !== '' && win.location.href !== leftAt) {
      try {
        win.history.replaceState(win.history.state, '', leftAt);
      } catch {
        // (kept as it was)
      }
    }
    if (active && !ours(win.history.state)) push();
  };

  const onPop = (e: PopEvent): void => {
    if (popping) {
      popped();
      return;
    }
    if (!active) return;
    if (ours(win.history.state)) {
      // A cushion took it: nothing happens, and the hub's guard never hears of it.
      log(`back -> cushion ${cushionDepth(win.history.state)} (stayed)`);
      e.stopImmediatePropagation();
      return;
    }
    log('back -> past the cushions (pause)');
    push();
    back();
  };

  // Now, as the game boots: listeners on window run in the order they were added (capture or not), and this must run
  // before the hub's own guard (its menu script loads after the game), or the hub answers a cushion's Back first by
  // opening its menu and pushing an untapped entry over the cushions.
  win.addEventListener('popstate', onPop, true);

  return {
    get active(): boolean {
      return active;
    },
    on(onBack) {
      back = onBack;
      if (active) return;
      active = true;
      if (!popping && !ours(win.history.state)) push();
    },
    cushion() {
      const depth = cushionDepth(win.history.state);
      if (!active || popping || depth < 0 || depth >= CUSHIONS) return;
      push({ [DEPTH]: depth + 1 });
      log(`cushion ${depth + 1}`);
    },
    off() {
      if (!active) return;
      active = false;
      const depth = cushionDepth(win.history.state);
      if (popping || depth < 0) return;
      popping = true;
      leftAt = win.location.href;
      popTimer = win.setTimeout(popped, POP_WAIT_MS);
      if (depth === 0) win.history.back();
      else win.history.go(-(depth + 1));
    },
  };
}

/** What the back guard takes. */
export type BackGuardOptions = {
  /** How close to a side a touch starts an edge swipe (default `EDGE_PX`, 24). */
  edgePx?: number;
  /** Cancel edge swipes (default true). */
  edges?: boolean;
  /** Keep a back on the page with history entries and a CloseWatcher (default true). */
  history?: boolean;
};

/** The touch and history guards together. */
export type BackGuard = {
  readonly on: boolean;
  readonly history: HistoryGuard;
  /** Turn on (or keep on: calling it again only replaces `onBack`). */
  start(onBack: () => void): void;
  /** Turn off. */
  stop(): void;
};

type Watcher = { onclose: (() => void) | null; destroy(): void };
const isWatcher = (v: unknown): v is Watcher => isObject(v) && typeof v.destroy === 'function' && 'onclose' in v;

/** A new CloseWatcher (Chrome 120+), or null where the window has none. */
function openWatcher(win: object): Watcher | null {
  const ctor: unknown = Reflect.get(win, 'CloseWatcher');
  if (typeof ctor !== 'function') return null;
  try {
    const w: unknown = Reflect.construct(ctor, []);
    return isWatcher(w) ? w : null;
  } catch {
    return null;
  }
}

/** The `?navlog=1` list: what the guard did, on screen and kept in sessionStorage across a reload. */
function navLog(doc: Document, href: string): (line: string) => void {
  const view = doc.defaultView;
  if (view === null || !new URL(href).searchParams.has('navlog')) return () => undefined;
  const KEY = 'kit:navlog';
  const box = doc.createElement('pre');
  box.style.cssText =
    'position:fixed;left:4px;top:4px;z-index:2147483647;max-width:70vw;max-height:40vh;overflow:auto;margin:0;padding:4px 6px;font:11px/1.3 monospace;color:#fff;background:rgba(0,0,0,.75);pointer-events:none;white-space:pre-wrap';
  const lines = (view.sessionStorage.getItem(KEY) ?? '').split('\n').filter(Boolean);
  doc.body.append(box);
  const log = (line: string): void => {
    const t = Math.floor(realClock.now() / 1000) % 3600;
    const at = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    lines.push(`${at} ${line} [len ${view.history.length}]`);
    view.sessionStorage.setItem(KEY, lines.slice(-40).join('\n'));
    box.textContent = lines.slice(-14).join('\n');
  };
  log(
    `load closeWatcher=${typeof Reflect.get(view, 'CloseWatcher') === 'function'} ${view.navigator.userAgent.slice(-40)}`,
  );
  view.addEventListener('pagehide', () => log('pagehide'));
  return log;
}

/** The touch and history guards together, on a document and its window. */
export function backGuard(doc: Document, win: GuardWindow, o: BackGuardOptions = {}): BackGuard {
  const log = o.history === false ? () => undefined : navLog(doc, win.location.href);
  const history = historyGuard(win, log);
  let on = false;
  let watcher: Watcher | null = null;

  const onTouch = (e: TouchEvent): void => {
    const xs = Array.from(e.changedTouches, (t) => t.clientX);
    if (e.cancelable && edgeSwipe(xs, e.composedPath(), doc.documentElement.clientWidth, o.edgePx)) e.preventDefault();
  };

  /** The player's tap or key: what's made inside one is never skipped by the browser's Back. */
  const onGesture = (e: Event): void => {
    history.cushion();
    // (an Esc closes the watchers, so one made inside its own keydown would close at once)
    if (watcher !== null || (e instanceof KeyboardEvent && e.key === 'Escape')) return;
    watcher = openWatcher(win);
    if (watcher === null) return;
    log('watcher on');
    watcher.onclose = () => {
      watcher = null;
      log('back -> watcher (stayed)');
    };
  };

  const dropWatcher = (): void => {
    if (watcher === null) return;
    watcher.onclose = null;
    watcher.destroy();
    watcher = null;
  };

  return {
    get on(): boolean {
      return on;
    },
    history,
    start(onBack) {
      if (o.history !== false) history.on(onBack);
      if (on) return;
      on = true;
      doc.documentElement.classList.add(BACK_GUARD_CLASS);
      if (o.edges !== false) doc.addEventListener('touchstart', onTouch, { capture: true, passive: false });
      if (o.history !== false) {
        doc.addEventListener('pointerup', onGesture, true);
        doc.addEventListener('keydown', onGesture, true);
      }
    },
    stop() {
      history.off();
      if (!on) return;
      on = false;
      doc.documentElement.classList.remove(BACK_GUARD_CLASS);
      doc.removeEventListener('touchstart', onTouch, { capture: true });
      doc.removeEventListener('pointerup', onGesture, true);
      doc.removeEventListener('keydown', onGesture, true);
      dropWatcher();
    },
  };
}

let shared: BackGuard | null = null;

/** The page's one back guard (null outside a browser). The kit drives it in play; a game may too. */
export function pageBackGuard(o?: BackGuardOptions): BackGuard | null {
  if (typeof document === 'undefined') return null;
  shared ??= backGuard(document, window, o);
  return shared;
}
