/**
 * kit/ui: one screen at a time (title, play, pause, result, lobby…), with presence.
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Screens"
 *
 * `show(name, build)` swaps the screen; the root gets `data-screen=<name>`
 * (CSS and the screenshot runner read it), and presence is reported for the
 * screen, coalesced (only when it changes; garbage `show()`). A screen drawn again
 * keeps where it was scrolled to: the screen and every scrolled part inside it, even
 * one the game made after the screen mounted (a card it wraps the lobby in), found
 * again by its path of tags and classes, and set again once the game has dressed the
 * new screen (a microtask and two frames later) unless the player scrolls first. On a
 * touch screen a new one opens at its top (its autofocus control is focused without
 * scrolling to it).
 */
import type { PresenceInput } from '@diffenderfer-games/hub';
import { ui } from './root.ts';

/** The control in `el` with the same test id as `was` (not `was` itself), or null. */
function sameControl(el: HTMLElement, was: HTMLElement): HTMLElement | null {
  const id = was.dataset['testid'];
  if (id === undefined || el.contains(was)) return null;
  return [...el.querySelectorAll<HTMLElement>('[data-testid]')].find((c) => c.dataset['testid'] === id) ?? null;
}

/** Where an element sits under `root`: tag and classes of each step, with the index among like siblings. */
function pathOf(el: Element, root: Element): string {
  const steps: string[] = [];
  for (let e: Element | null = el; e !== null && e !== root; e = e.parentElement) {
    const key = (x: Element): string => [x.tagName, ...[...x.classList].sort()].join('.');
    const k = key(e);
    const i = e.parentElement ? [...e.parentElement.children].filter((c) => key(c) === k).indexOf(e) : 0;
    steps.push(`${k}:${i}`);
  }
  return steps.reverse().join('>');
}

/** One scrolled part of a screen: its path ('' for the screen itself) and where it was scrolled to. */
type Scrolled = { path: string; last: string; top: number; left: number };

/** Every scrolled part of `el` (the screen itself included). */
function scrollsOf(el: HTMLElement): Scrolled[] {
  const out: Scrolled[] = [];
  for (const e of [el, ...el.querySelectorAll('*')]) {
    if (e.scrollTop <= 0 && e.scrollLeft <= 0) continue;
    const path = e === el ? '' : pathOf(e, el);
    out.push({ path, last: path.slice(path.lastIndexOf('>') + 1), top: e.scrollTop, left: e.scrollLeft });
  }
  return out;
}

/**
 * Scroll the parts of `el` back to `was`: the part at the same path, or else the one part whose own
 * step matches (the game may wrap things differently while it dresses the screen).
 */
function restoreScrolls(el: HTMLElement, was: readonly Scrolled[]): void {
  const parts = [el, ...el.querySelectorAll('*')].map((e) => {
    const path = e === el ? '' : pathOf(e, el);
    return { e, path, last: path.slice(path.lastIndexOf('>') + 1) };
  });
  for (const w of was) {
    const at = parts.find((p) => p.path === w.path) ?? parts.filter((p) => p.last === w.last);
    const p = Array.isArray(at) ? (at.length === 1 ? at[0] : undefined) : at;
    if (p === undefined) continue;
    if (p.e.scrollTop !== w.top) p.e.scrollTop = w.top;
    if (p.e.scrollLeft !== w.left) p.e.scrollLeft = w.left;
  }
}

/** The ways a player scrolls (or moves the focus) themselves: after one, a redraw stops restoring. */
const PLAYER_SCROLLS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/** A screen manager over the UI root. */
export class Screens {
  private name = '';
  private el: HTMLElement | null = null;
  private lastPresence: PresenceInput | null = null;
  private readonly setPresence: ((p: PresenceInput) => void) | null;

  constructor(setPresence: ((p: PresenceInput) => void) | null = null) {
    this.setPresence = setPresence;
  }

  /** The current screen's name. */
  get current(): string {
    return this.name;
  }

  /** The current screen's element. */
  get element(): HTMLElement | null {
    return this.el;
  }

  /** Show `name`, built by `build()`; report `presence` (default: menu, or playing for `play`). */
  show(name: string, build: () => HTMLElement, opts: { presence?: PresenceInput } = {}): HTMLElement {
    const root = ui().root;
    // Drawn again while it shows (a lobby on each change in the room): data-redraw skips entrance
    // animations, and focus on a part the new screen keeps (the chat box) stays put.
    const redraw = this.el !== null && this.name === name;
    const focused = document.activeElement;
    const scrolled = redraw && this.el ? scrollsOf(this.el) : [];
    this.el?.remove();
    const el = build();
    el.classList.add('kit-screen');
    el.dataset.screen = name;
    if (redraw) el.dataset.redraw = 'true';
    root.appendChild(el);
    root.dataset.screen = name;
    this.name = name;
    this.el = el;
    if (scrolled.length > 0) this.keepScrolls(el, scrolled);
    const presence = opts.presence ?? { kind: name === 'play' ? 'playing' : 'menu' };
    if (this.setPresence && JSON.stringify(presence) !== JSON.stringify(this.lastPresence)) {
      this.lastPresence = presence;
      this.setPresence(presence);
    }
    const again = redraw && focused instanceof HTMLElement ? sameControl(el, focused) : null;
    if (redraw && focused instanceof HTMLElement && el.contains(focused)) focused.focus({ preventScroll: true });
    // A control drawn anew (a lobby's button on a change in the room) keeps the focus by its test id.
    else if (again !== null) again.focus({ preventScroll: true });
    else
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus({
        preventScroll: document.documentElement.dataset['hubInput'] === 'touch',
      });
    return el;
  }

  /**
   * Put the new screen's scrolled parts back now, after the game's dressing (its MutationObserver's
   * microtasks), and on the next two frames (layout done), until the player scrolls or it is replaced.
   */
  private keepScrolls(el: HTMLElement, was: readonly Scrolled[]): void {
    let done = false;
    const stop = (): void => {
      done = true;
      for (const t of PLAYER_SCROLLS) el.removeEventListener(t, stop, true);
    };
    for (const t of PLAYER_SCROLLS) el.addEventListener(t, stop, { capture: true, passive: true });
    const again = (): void => {
      if (!done && this.el === el && el.isConnected) restoreScrolls(el, was);
    };
    again();
    // The game's MutationObserver runs in a microtask and may queue its dressing in another.
    queueMicrotask(() => queueMicrotask(() => queueMicrotask(again)));
    if (typeof requestAnimationFrame === 'function')
      requestAnimationFrame(() => {
        again();
        requestAnimationFrame(() => {
          again();
          stop();
        });
      });
    else setTimeout(() => (again(), stop()), 32);
  }
}
