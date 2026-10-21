/**
 * kit/ui: the back guard. While it is on (the kit turns it on for play), a swipe from the screen's
 * side or the phone's back gesture doesn't leave the game; it calls `onBack` instead (the kit's
 * pause, which asks "Leave race?" / "Leave match?" where a game can't pause).
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "The back guard"
 *
 * - `html.kit-back-guard` (KIT_CSS): `touch-action: none` on the stage and the play screen, no
 *   overscroll, so a drag plays instead of scrolling or swiping.
 * - A touch that starts within `edgePx` of the left or right side, not on a control, has its
 *   `touchstart` cancelled (iOS Safari's swipe back/forward). A control (a button, the hub's) is
 *   left alone: cancelling its touchstart would cancel its click too.
 * - A history entry is pushed (once) on top of the page's: a back that can't be cancelled
 *   (Android's back gesture, a swipe that slipped through) lands on the page's own entry instead
 *   of leaving; the entry goes back on and `onBack` runs. When the guard turns off the entry is
 *   taken off again (`history.back()`, keeping an address the hub tidied meanwhile), so Back in
 *   the menus leaves as it always did. The hub only ever `replaceState`s, so the two never fight.
 */

/** How close to the left or right side (CSS px) a touch starts an edge swipe, by default. */
export const EDGE_PX = 24;

/** `<html>`'s class while the guard is on. */
export const BACK_GUARD_CLASS = 'kit-back-guard';

/** What a touch on these must still do (tap, click, focus). */
const CONTROLS = 'button, a[href], input, select, textarea, label, summary, [role="button"], [contenteditable="true"]';

/** Marks the history entry the guard pushed. */
const MARK = 'kitBackGuard';

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

/** The window's parts the history guard uses (the page's `window`; a fake in tests). */
export type GuardWindow = {
  readonly history: Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;
  readonly location: { readonly href: string };
  addEventListener(type: 'popstate', listener: () => void): void;
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(id: number): void;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ours = (state: unknown): boolean => isObject(state) && state[MARK] === true;

/** The history guard alone: what keeps a back on the page (see the top). */
export type HistoryGuard = {
  readonly active: boolean;
  /** Push the entry (once, however many times it is called); a back then calls `onBack`. */
  on(onBack: () => void): void;
  /** Take the entry off (only if it's still the one showing). */
  off(): void;
};

/** The history entry that keeps a back on the page (see the top). */
export function historyGuard(win: GuardWindow): HistoryGuard {
  let active = false;
  let back: () => void = () => undefined;
  /** The guard's own back is under way (its popstate is not the player's). */
  let popping = false;
  let popTimer = 0;
  /** The address when the guard came off (the hub may tidy it meanwhile). */
  let leftAt = '';
  let listening = false;

  const push = (): void => {
    const state: unknown = win.history.state;
    try {
      win.history.pushState({ ...(isObject(state) ? state : {}), [MARK]: true }, '', win.location.href);
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

  const onPop = (): void => {
    if (popping) {
      popped();
      return;
    }
    if (!active || ours(win.history.state)) return;
    push();
    back();
  };

  return {
    get active(): boolean {
      return active;
    },
    on(onBack) {
      back = onBack;
      if (!listening) {
        listening = true;
        win.addEventListener('popstate', onPop);
      }
      if (active) return;
      active = true;
      if (!popping && !ours(win.history.state)) push();
    },
    off() {
      if (!active) return;
      active = false;
      if (popping || !ours(win.history.state)) return;
      popping = true;
      leftAt = win.location.href;
      popTimer = win.setTimeout(popped, POP_WAIT_MS);
      win.history.back();
    },
  };
}

/** What the back guard takes. */
export type BackGuardOptions = {
  /** How close to a side a touch starts an edge swipe (default `EDGE_PX`, 24). */
  edgePx?: number;
  /** Cancel edge swipes (default true). */
  edges?: boolean;
  /** Keep a back on the page with a history entry (default true). */
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

/** The touch and history guards together, on a document and its window. */
export function backGuard(doc: Document, win: GuardWindow, o: BackGuardOptions = {}): BackGuard {
  const history = historyGuard(win);
  let on = false;
  const onTouch = (e: TouchEvent): void => {
    const xs = Array.from(e.changedTouches, (t) => t.clientX);
    if (e.cancelable && edgeSwipe(xs, e.composedPath(), doc.documentElement.clientWidth, o.edgePx)) e.preventDefault();
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
    },
    stop() {
      history.off();
      if (!on) return;
      on = false;
      doc.documentElement.classList.remove(BACK_GUARD_CLASS);
      doc.removeEventListener('touchstart', onTouch, { capture: true });
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
