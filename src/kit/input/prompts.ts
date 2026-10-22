/**
 * kit/input: button prompts that work. Which chips show (keys, pad, none), and pressing a bound
 * key or pad button presses its control on the current screen or the top modal.
 * Source: dg-template src/kit/input/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/input.md § "Button prompts"
 *
 * - The mode follows the last device used: a key or a mouse (desktop) shows keycaps, a pad its
 *   glyphs (Xbox, or PlayStation when its id says Sony), a finger nothing. It lives on `<html>`
 *   as `data-prompts` (`keys`, `pad`, `none`) and `data-pad-style` (`xbox`, `ps`), so chips swap
 *   in CSS the moment it changes.
 * - Bindings fire only while `active()` (the kit: not in active play, no hub UI open), only
 *   inside the top modal (else the screens), and never for the hub's own pad buttons
 *   (`hub.input.padButtons`: menu, act, back): A presses the highlighted control and B goes
 *   back through the kit's menu navigation, which presses a `back`-bound control (nav.ts).
 * - Enter presses the `confirm` control when no control has focus (a focused one gets its own
 *   Enter). Arrows move focus between the controls as the pad's d-pad does; on a stepper
 *   (`axisControl`) left and right step it instead.
 */
import { AXIS_DEADZONE, PAD_AXIS_ACTIVITY, PAD_BUTTON, PAD_BUTTON_ACTIVITY } from '@diffenderfer-games/hub/input';
import type { HubLike } from '../core/hub-like.ts';
import { bindingOf, bindKitControls, type PromptBinding } from './glyphs.ts';
import { navScope, navTargets } from './nav.ts';

/** Which chips show. */
export type PromptMode = 'keys' | 'pad' | 'none';
/** Which pad's glyphs. */
export type PadStyle = 'xbox' | 'ps';

/** A pad's glyph style from its id (Sony, DualShock, DualSense, PlayStation: `ps`). */
export function padStyleOf(id: string): PadStyle {
  return /sony|dualshock|dualsense|playstation|054c/i.test(id) ? 'ps' : 'xbox';
}

/** Set the mode and style on `<html>` (CSS shows the matching chips). */
export function setPromptMode(mode: PromptMode, style?: PadStyle): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (html.dataset.prompts !== mode) html.dataset.prompts = mode;
  if (style !== undefined && html.dataset.padStyle !== style) html.dataset.padStyle = style;
}

/** The mode on `<html>` now. */
export function promptMode(): PromptMode {
  const m = typeof document === 'undefined' ? undefined : document.documentElement.dataset.prompts;
  return m === 'pad' || m === 'none' ? m : 'keys';
}

/** What `installPrompts` needs. */
export type PromptsSpec = {
  root: HTMLElement;
  /** Do bindings fire now (default: always)? The kit: not in active play. */
  active?(): boolean;
  /** Is the pad's menu navigation on now (a stepper's d-pad steps only then)? Default: `active`. */
  navActive?(): boolean;
  /** The pad glyphs: `auto` (from the pad's id, default), or always one style. */
  padStyle?: PadStyle | 'auto';
  /** Arrows move focus between the controls (default true). */
  arrows?: boolean;
  /** Where keydown arrives (default `window`). */
  keys?: EventTarget;
};

/** A stepper's step event (`axisControl`). */
export const STEP_EVENT = 'kit-step';

/** Is the player typing in a field? */
function typing(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement) return el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'radio';
  return (
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/** Does a focused element take Enter itself (a button, a link, a field)? */
function takesEnter(el: Element | null): boolean {
  if (el === null || el === document.body || el.hasAttribute('data-nav-axis')) return false;
  return el.matches('button, a[href], input, select, textarea, summary, [role="button"], [contenteditable]');
}

function shown(el: HTMLElement): boolean {
  if (el.hidden || el.closest('[hidden]') !== null) return false;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  return style === null || (style.display !== 'none' && style.visibility !== 'hidden');
}

/** The bound controls in scope (the top modal's, else the screens'), shown and enabled. */
export function boundControls(root: ParentNode): HTMLElement[] {
  return [...navScope(root).querySelectorAll<HTMLElement>('[data-action]')].filter(shown);
}

/** The control in scope bound to `action`, or null. */
export function actionControl(root: ParentNode, action: string): HTMLElement | null {
  return boundControls(root).find((el) => el.getAttribute('data-action') === action) ?? null;
}

/** Press the control bound to `action` in scope; true when there was one. */
export function pressAction(root: ParentNode, action: string): boolean {
  const el = actionControl(root, action);
  if (el === null) return false;
  el.click();
  return true;
}

/** The first control in scope whose binding matches. */
function matching(root: ParentNode, match: (b: PromptBinding) => boolean): HTMLElement | null {
  for (const el of boundControls(root)) {
    const b = bindingOf(el);
    if (b !== null && match(b)) return el;
  }
  return null;
}

/**
 * A stepper: one focusable row whose left and right (arrows, the d-pad, the stick) call `step`
 * while it has focus, and whose act (Enter, the pad's A) presses the scope's `confirm` control
 * (or `act`). Keep it alone in its row so the d-pad has nothing beside it to move to.
 */
export function axisControl<E extends HTMLElement>(
  el: E,
  step: (dir: -1 | 1) => void,
  o: { act?: () => void; root?: ParentNode } = {},
): E {
  el.setAttribute('data-nav', '');
  el.setAttribute('data-nav-axis', 'x');
  if (!el.matches('button, a[href], input')) el.tabIndex = 0;
  el.addEventListener(STEP_EVENT, (e) => {
    const dir: unknown = e instanceof CustomEvent ? e.detail : null;
    if (dir === -1 || dir === 1) step(dir);
  });
  const act = (): void => {
    if (o.act) o.act();
    else pressAction(o.root ?? el.closest('[data-modal]') ?? el.closest('.kit-ui') ?? document, 'confirm');
  };
  // (the hub's A clicks it with no mouse: detail 0; Enter arrives as a key)
  el.addEventListener('click', (e) => {
    if (e.detail === 0 && e.target === el) act();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === el) {
      e.preventDefault();
      act();
    }
  });
  return el;
}

/** Is it a stepper (`axisControl`) or a slider: left and right change it? */
export function isAxis(el: Element | null): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    (el.hasAttribute('data-nav-axis') || (el instanceof HTMLInputElement && el.type === 'range'))
  );
}

/** Step a stepper, or move a slider a twentieth of its range (the hub keeps the arrows from the page). */
function stepAxis(el: Element, dir: -1 | 1): void {
  if (el instanceof HTMLInputElement && el.type === 'range') {
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    const step = Math.max(Number(el.step) || 1, (max - min) / 20);
    el.value = String(Math.max(min, Math.min(max, Number(el.value) + dir * step)));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  el.dispatchEvent(new CustomEvent(STEP_EVENT, { detail: dir }));
}

/** The nearest control from `from` strictly in a direction (the hub's spatial rule: off-axis counts double). */
export function nearestInDirection(
  targets: readonly HTMLElement[],
  from: HTMLElement,
  dir: 'up' | 'down' | 'left' | 'right',
): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let score = Infinity;
  for (const el of targets) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ax;
    const dy = r.top + r.height / 2 - ay;
    const travel = { up: -dy, down: dy, left: -dx, right: dx }[dir];
    if (travel <= 4) continue;
    const s = travel + (dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy)) * 2;
    if (s < score) {
      score = s;
      best = el;
    }
  }
  return best;
}

const ARROWS: Readonly<Record<string, 'up' | 'down' | 'left' | 'right'>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Held-direction repeats: the first at once, then after 320 ms, then every 110 ms. */
function repeater(): (held: boolean, now: number) => boolean {
  let since = -1;
  let next = 0;
  return (held, now) => {
    if (!held) {
      since = -1;
      return false;
    }
    if (since < 0) {
      since = now;
      next = now + 320;
      return true;
    }
    if (now < next) return false;
    next = now + 110;
    return true;
  };
}

/**
 * Track the device for the chips, and make bound controls answer their keys and pad buttons.
 * Returns the unsubscribe.
 */
export function installPrompts(hub: Pick<HubLike, 'input' | 'overlay'>, o: PromptsSpec): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const html = document.documentElement;
  const fixed = o.padStyle === 'xbox' || o.padStyle === 'ps' ? o.padStyle : null;
  const firing = (): boolean => !hub.overlay.isOpen && (o.active?.() ?? true);
  const touchNow = (): boolean => hub.input.source === 'touch' || html.getAttribute('data-hub-input') === 'touch';
  setPromptMode(hub.input.source === 'gamepad' ? 'pad' : touchNow() ? 'none' : 'keys', fixed ?? undefined);
  if (html.dataset.padStyle === undefined) html.dataset.padStyle = fixed ?? 'xbox';

  const offs: (() => void)[] = [];
  offs.push(
    hub.input.on('sourcechange', (s) => {
      if (s === 'gamepad') setPromptMode('pad');
      else if (s === 'touch') setPromptMode('none');
      else if (s === 'mouse' && html.getAttribute('data-hub-input') !== 'touch') setPromptMode('keys');
    }),
  );
  const onPointer = (e: Event): void => {
    const kind: unknown = Reflect.get(e, 'pointerType');
    if (e.type === 'touchstart' || kind === 'touch') setPromptMode('none');
    else if (kind === 'mouse') setPromptMode('keys');
  };
  for (const type of ['pointerdown', 'touchstart']) {
    addEventListener(type, onPointer, { capture: true, passive: true });
    offs.push(() => removeEventListener(type, onPointer, { capture: true }));
  }

  // The kit's own controls get their actions and chips as they appear (none while racing: the HUD redraws often).
  if (typeof MutationObserver === 'function') {
    let queued = false;
    const bind = (): void => {
      queued = false;
      const screen = o.root.dataset.screen ?? '';
      if (screen === 'play' && o.root.querySelector('[data-modal]') === null) return;
      bindKitControls(o.root, screen);
    };
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(bind);
    });
    observer.observe(o.root, { childList: true, subtree: true });
    bind();
    offs.push(() => observer.disconnect());
  }

  // Keys.
  const keys = o.keys ?? window;
  const onKey = (e: Event): void => {
    if (!(e instanceof KeyboardEvent) || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    setPromptMode('keys');
    // (the hub cancels the arrows and Space to stop the page scrolling: those still count)
    const used = e.defaultPrevented && ARROWS[e.key] === undefined && e.key !== ' ';
    if (used || e.ctrlKey || e.metaKey || e.altKey || !firing() || typing()) return;
    const root = o.root;
    const focused = document.activeElement;
    const inScope = focused instanceof HTMLElement && navScope(root).contains(focused) ? focused : null;
    const arrow = ARROWS[e.key];
    if (arrow !== undefined && o.arrows !== false) {
      if (isAxis(inScope) && (arrow === 'left' || arrow === 'right')) {
        e.preventDefault();
        stepAxis(inScope, arrow === 'left' ? -1 : 1);
        return;
      }
    }
    if (e.key === 'Escape') return; // (the kit's menu navigation: back)
    if (e.key === 'Enter') {
      if (takesEnter(focused) || e.repeat) return;
      const el = matching(root, (b) => b.keys.some((k) => k.toLowerCase() === 'enter'));
      if (el !== null) {
        e.preventDefault();
        el.click();
      }
      return;
    }
    const key = e.key.toLowerCase();
    const el = matching(root, (b) => b.keys.some((k) => k.toLowerCase() === key));
    if (el !== null) {
      e.preventDefault();
      if (!e.repeat || arrow !== undefined || el.hasAttribute('data-action-repeat')) el.click();
      return;
    }
    if (arrow === undefined || o.arrows === false) return;
    const targets = navTargets(root);
    if (targets.length === 0) return;
    e.preventDefault();
    const next =
      inScope !== null && targets.includes(inScope) ? nearestInDirection(targets, inScope, arrow) : targets[0];
    next?.focus();
  };
  keys.addEventListener('keydown', onKey);
  offs.push(() => keys.removeEventListener('keydown', onKey));

  // The pad, once a frame.
  let held = new Set<number>();
  const stepLeft = repeater();
  const stepRight = repeater();
  let frame = 0;
  let stopped = false;
  const tick = (now: number): void => {
    if (stopped) return;
    const pads =
      typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const now2 = typeof now === 'number' ? now : performance.now();
    const pressed = new Set<number>();
    let lx = 0;
    for (const pad of pads) {
      if (pad === null) continue;
      let busy = false;
      pad.buttons.forEach((b, i) => {
        if (b.pressed) pressed.add(i);
        if (b.value > PAD_BUTTON_ACTIVITY) busy = true;
      });
      if (pad.axes.some((a) => Math.abs(a) > PAD_AXIS_ACTIVITY)) busy = true;
      if (Math.abs(pad.axes[0] ?? 0) > Math.abs(lx)) lx = pad.axes[0] ?? 0;
      if (busy) setPromptMode('pad', fixed ?? padStyleOf(pad.id));
    }
    const rose = [...pressed].filter((b) => !held.has(b));

    held = pressed;
    if (firing()) {
      const reserved = new Set([
        ...(hub.input.padButtons?.menu ?? [8]),
        ...(hub.input.padButtons?.act ?? [0]),
        ...(hub.input.padButtons?.back ?? [1]),
      ]);
      for (const b of rose) {
        if (reserved.has(b)) continue;
        const el = matching(o.root, (x) => x.pad.includes(b));
        if (el !== null) {
          el.click();
          break;
        }
      }
      // A focused stepper: the d-pad and the stick step it (the hub's navigation has nothing beside it).
      const focused = document.activeElement;
      const axis = (o.navActive?.() ?? true) && isAxis(focused) && navScope(o.root).contains(focused) ? focused : null;
      const left = pressed.has(PAD_BUTTON.LEFT) || lx < -AXIS_DEADZONE;
      const right = pressed.has(PAD_BUTTON.RIGHT) || lx > AXIS_DEADZONE;
      const goLeft = stepLeft(axis !== null && left && !right, now2);
      const goRight = stepRight(axis !== null && right && !left, now2);
      if (axis !== null && goLeft) stepAxis(axis, -1);
      if (axis !== null && goRight) stepAxis(axis, 1);
    }
    frame = requestAnimationFrame(tick);
  };
  if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(tick);
  offs.push(() => {
    stopped = true;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
  });
  return () => offs.forEach((off) => off());
}
