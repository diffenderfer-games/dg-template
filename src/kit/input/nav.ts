/**
 * kit/input: menu navigation (gamepad, keys), control hints, HUD insets, held-key repeat.
 * Source: dg-template src/kit/input/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/input.md § "Menus"
 *
 * The hub's `autoNavigate` moves focus between the elements `navTargets`
 * returns: the topmost open modal's controls, else the current screen's
 * (bingo's target function). Back closes the top modal unless it is locked
 * (phase10/uno), else calls the game's back.
 *
 * While `active()` is false (by default: active play whose controls use the
 * pad's act or back button) there are no pad targets, so A and B are the
 * game's and never click a HUD button. The kit's CSS draws the focus look
 * (`--kit-focus-*`, kit/ui/css.ts), so the hub's ring is off (`ring`).
 *
 * Back presses the control bound to `back` in the top modal or the screen, when there is one.
 *
 * Escape on a keyboard is the same back, and it calls `preventDefault()` only
 * when something went back (or the game's own inputs read Esc, e.g. `pause`
 * in play): in the world's box an Esc nobody used leaves the game, so on the
 * title it must stay unhandled (hub.md "Playing over the world").
 */
import type { NavElement, NavTarget } from '@diffenderfer-games/hub';
import type { HubLike } from '../core/hub-like.ts';
import { closeTopModal, topModal } from '../ui/modal.ts';

/** Where navigation and bound controls are: the topmost open modal, else `root` (the screens). */
export function navScope(root: ParentNode): ParentNode {
  const modals = root.querySelectorAll<HTMLElement>('[data-modal]');
  return modals.length > 0 ? (modals[modals.length - 1] ?? root) : root;
}

/**
 * The navigable controls: the topmost modal's, else the screens'. Hidden and disabled ones are
 * skipped; the `confirm`-bound control comes first (the pad's first highlight). While a stepper
 * (`data-nav-axis`) or a slider has focus, the controls beside it are left out, so left and right change it.
 */
export function navTargets(root: ParentNode): HTMLElement[] {
  const all = [...navScope(root).querySelectorAll<HTMLElement>('[data-nav]')].filter(
    (el) => !isDisabled(el) && isShown(el),
  );
  const confirm = all.findIndex((el) => el.getAttribute('data-action') === 'confirm');
  const first = confirm > 0 ? all.splice(confirm, 1) : [];
  const ordered = [...first, ...all];
  const focused = typeof document === 'undefined' ? null : document.activeElement;
  const axis =
    focused instanceof HTMLElement &&
    (focused.hasAttribute('data-nav-axis') || (focused instanceof HTMLInputElement && focused.type === 'range'));
  if (!axis || !ordered.includes(focused)) return ordered;
  const a = focused.getBoundingClientRect();
  if (a.height <= 0) return ordered;
  return ordered.filter((el) => {
    if (el === focused) return true;
    const r = el.getBoundingClientRect();
    return r.bottom <= a.top + 2 || r.top >= a.bottom - 2;
  });
}

/** The control in the top modal (else the screens) bound to `back`, shown and enabled. */
function backControl(root: ParentNode): HTMLElement | null {
  const el = [...navScope(root).querySelectorAll<HTMLElement>('[data-action="back"]')].find(
    (c) => !isDisabled(c) && isShown(c),
  );
  return el ?? null;
}

/** Is the player typing in a field? */
function isTyping(): boolean {
  const el = typeof document === 'undefined' ? null : document.activeElement;
  return (
    (el instanceof HTMLInputElement && el.type !== 'range') ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

function isDisabled(el: HTMLElement): boolean {
  return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
}

function isShown(el: HTMLElement): boolean {
  if (el.hidden || el.closest('[hidden]') !== null) return false;
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  return style === null || (style.display !== 'none' && style.visibility !== 'hidden');
}

/** What `installMenuNav` needs. */
export type MenuNavSpec = {
  root: HTMLElement;
  /** The screen's back (pause, resume, to the title); false when there is nowhere to go back to. */
  back(): boolean;
  /** Back does nothing (a choice the game is waiting on). */
  locked?(): boolean;
  /** Esc is the game's now without going back (its play inputs read it); the kit marks it handled. */
  ownsEscape?(): boolean;
  /** Where keydown arrives (default `window`). */
  keys?: EventTarget;
  /** Is pad navigation on now (default: always)? False: no targets, so the pad's A and B are the game's. Esc is unaffected. */
  active?(): boolean;
  /** Draw the hub's ring over the focused control too (default false: the kit's CSS draws focus). */
  ring?: boolean;
};

/**
 * Make the kit's menus navigable once; back (the pad's B, a keyboard's Esc)
 * closes the top modal unless it is locked. Returns the unsubscribe.
 */
export function installMenuNav(hub: Pick<HubLike, 'input' | 'overlay'>, o: MenuNavSpec): () => void {
  // Back presses the control bound to `back` (kit/input/glyphs.ts) when there is one, else closes the top modal or
  // goes back on the screen.
  const back = (): boolean => {
    if (o.locked?.() === true) return false;
    const bound = isTyping() ? null : backControl(o.root);
    if (bound !== null) {
      bound.click();
      return true;
    }
    if (topModal() !== null) return closeTopModal();
    return o.back();
  };
  hub.input.autoNavigate(() => (o.active?.() === false ? [] : navTargets(o.root)), {
    back: () => void back(),
    ring: o.ring === true,
  });
  const keys = o.keys ?? (typeof window === 'undefined' ? null : window);
  const onKey = (e: Event): void => {
    if (!(e instanceof KeyboardEvent) || e.key !== 'Escape' || e.defaultPrevented || hub.overlay.isOpen) return;
    if (o.ownsEscape?.() === true || (!e.repeat && back())) e.preventDefault();
  };
  keys?.addEventListener('keydown', onKey);
  return () => keys?.removeEventListener('keydown', onKey);
}

/** Canvas buttons (Pixi menus) as nav targets: bounds + act (downfall button.ts). */
export function canvasNavElements(
  buttons: () => readonly {
    id: string;
    bounds(): { x: number; y: number; width: number; height: number };
    act(): void;
  }[],
): () => NavTarget[] {
  return () =>
    buttons().map((b): NavElement => ({ id: b.id, kind: 'button', getBounds: () => b.bounds(), onAct: () => b.act() }));
}

/** Which hints to show: keys, touch or pad (weston controlHints). Calls `cb` now and on every change. */
export function controlHints(hub: Pick<HubLike, 'input'>, cb: (kind: 'keys' | 'touch' | 'pad') => void): () => void {
  const kindOf = (source: string): 'keys' | 'touch' | 'pad' =>
    source === 'touch' ? 'touch' : source === 'gamepad' ? 'pad' : 'keys';
  cb(kindOf(hub.input.source));
  return hub.input.on('sourcechange', (s) => cb(kindOf(s)));
}

/** Keep the hub's auto-placed touch controls off HUD bands (quanta syncControlInsets). */
export function setHudInsets(
  hub: Pick<HubLike, 'input'>,
  bands: { top?: readonly Element[]; bottom?: readonly Element[] },
): void {
  const h = typeof innerHeight === 'number' ? innerHeight : 0;
  const top = Math.max(0, ...(bands.top ?? []).map((el) => el.getBoundingClientRect().bottom));
  const bottom = Math.max(0, ...(bands.bottom ?? []).map((el) => h - el.getBoundingClientRect().top));
  // Newer than some hub builds (docs/hub.md): guard it.
  if (typeof hub.input.setInsets === 'function')
    hub.input.setInsets({ top: Math.round(top), bottom: Math.round(bottom) });
}

/**
 * Turn a held button into repeats (solitaire pressed()): true on the press,
 * then after `first` ms, then every `next` ms. Call once per frame with dt in ms.
 */
export function repeatPress(read: () => boolean, o: { first?: number; next?: number } = {}): (dtMs: number) => boolean {
  let held = 0;
  let nextAt = 0;
  return (dtMs) => {
    if (!read()) {
      held = 0;
      return false;
    }
    if (held === 0) {
      held = dtMs || 1;
      nextAt = o.first ?? 300;
      return true;
    }
    held += dtMs;
    if (held < nextAt) return false;
    nextAt += o.next ?? 90;
    return true;
  };
}
