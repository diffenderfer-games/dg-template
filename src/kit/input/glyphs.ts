/**
 * kit/input: button prompts. Actions (confirm, back, alt…) bound to keys and pad buttons, and the
 * small chips that show them: keycaps for keys, Xbox or PlayStation glyphs for a pad.
 * Source: dg-template src/kit/input/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/input.md § "Button prompts"
 *
 * A chip holds all three looks (keys, Xbox, PlayStation); `html[data-prompts]` and
 * `html[data-pad-style]` (kit/input/prompts.ts) pick the one showing, in CSS, so a chip
 * swaps the moment the player picks up another device and is never redrawn.
 */
import { PAD_BUTTON } from '@diffenderfer-games/hub/input';
import { h } from '../ui/dom.ts';

/** An action's keys (`KeyboardEvent.key`, any case) and pad buttons (standard-gamepad indices). */
export type PromptBinding = { readonly keys: readonly string[]; readonly pad: readonly number[] };

/** The kit's actions; a game may add its own names with `setPromptBindings`. */
export type PromptAction =
  | 'confirm'
  | 'back'
  | 'alt'
  | 'alt2'
  | 'prev'
  | 'next'
  | 'page-prev'
  | 'page-next'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'pause';

/**
 * The default bindings: A/Enter confirms, B/Esc goes back, X/F and Y/R are the secondary
 * actions, the shoulders (LB/RB, Q/E) cycle the main choice, the triggers (LT/RT, Z/C) a
 * second one; the d-pad and arrows move.
 */
export const DEFAULT_PROMPT_BINDINGS: Readonly<Record<PromptAction, PromptBinding>> = {
  confirm: { keys: ['Enter'], pad: [PAD_BUTTON.A] },
  back: { keys: ['Escape'], pad: [PAD_BUTTON.B] },
  alt: { keys: ['f'], pad: [PAD_BUTTON.X] },
  alt2: { keys: ['r'], pad: [PAD_BUTTON.Y] },
  prev: { keys: ['q'], pad: [PAD_BUTTON.LB] },
  next: { keys: ['e'], pad: [PAD_BUTTON.RB] },
  'page-prev': { keys: ['z'], pad: [PAD_BUTTON.LT] },
  'page-next': { keys: ['c'], pad: [PAD_BUTTON.RT] },
  left: { keys: ['ArrowLeft'], pad: [PAD_BUTTON.LEFT] },
  right: { keys: ['ArrowRight'], pad: [PAD_BUTTON.RIGHT] },
  up: { keys: ['ArrowUp'], pad: [PAD_BUTTON.UP] },
  down: { keys: ['ArrowDown'], pad: [PAD_BUTTON.DOWN] },
  pause: { keys: ['Escape'], pad: [PAD_BUTTON.START] },
};

let bindings: Record<string, PromptBinding> = { ...DEFAULT_PROMPT_BINDINGS };

/** Change or add actions (merged over the defaults; `defineGame` passes `GameDefinition.prompts.bindings`). */
export function setPromptBindings(patch: Readonly<Record<string, Partial<PromptBinding>>>): void {
  const next: Record<string, PromptBinding> = { ...DEFAULT_PROMPT_BINDINGS };
  for (const [name, b] of Object.entries(patch)) {
    const base = next[name] ?? { keys: [], pad: [] };
    next[name] = { keys: b.keys ?? base.keys, pad: b.pad ?? base.pad };
  }
  bindings = next;
}

/** An action's binding now (unknown actions: none). */
export function promptBinding(action: string): PromptBinding {
  return bindings[action] ?? { keys: [], pad: [] };
}

/** An element's binding: its action's, or its own `data-action-keys` / `data-action-pad` (comma lists). */
export function bindingOf(el: Element): PromptBinding | null {
  const action = el.getAttribute('data-action');
  if (action === null) return null;
  const base = promptBinding(action);
  const keys = el.getAttribute('data-action-keys');
  const pad = el.getAttribute('data-action-pad');
  return {
    keys: keys === null ? base.keys : keys.split(',').filter((k) => k.length > 0),
    pad: pad === null ? base.pad : pad.split(',').map(Number).filter(Number.isInteger),
  };
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  enter: 'Enter',
  escape: 'Esc',
  ' ': 'Space',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  pageup: 'PgUp',
  pagedown: 'PgDn',
  backspace: '⌫',
  tab: 'Tab',
  shift: 'Shift',
};

/** A key as a keycap shows it. */
export function keyLabel(key: string): string {
  return KEY_NAMES[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key);
}

const SVG = 'http://www.w3.org/2000/svg';

/** A small SVG (paths in a 0..20 box) in the current colour. */
function svg(cls: string, ...paths: { d: string; fill?: boolean }[]): SVGSVGElement {
  const el = document.createElementNS(SVG, 'svg');
  el.setAttribute('viewBox', '0 0 20 20');
  el.setAttribute('class', cls);
  el.setAttribute('aria-hidden', 'true');
  for (const p of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', p.d);
    path.setAttribute('fill', p.fill === true ? 'currentColor' : 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', p.fill === true ? '0' : '2.2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    el.appendChild(path);
  }
  return el;
}

/** The PlayStation face shapes: cross, circle, square, triangle. */
const PS_SHAPES: readonly string[] = [
  'M6 6 L14 14 M14 6 L6 14',
  'M10 4.5 A5.5 5.5 0 1 1 9.99 4.5 Z',
  'M5.5 5.5 H14.5 V14.5 H5.5 Z',
  'M10 4.5 L15.5 14 H4.5 Z',
];
const FACE_NAMES = ['a', 'b', 'x', 'y'];
const XBOX_FACES = ['A', 'B', 'X', 'Y'];

/** The d-pad, with the arms in `lit` filled. */
function dpad(lit: readonly ('up' | 'down' | 'left' | 'right')[]): SVGSVGElement {
  const arms = {
    up: 'M7.5 1.5 H12.5 V7.5 H7.5 Z',
    down: 'M7.5 12.5 H12.5 V18.5 H7.5 Z',
    left: 'M1.5 7.5 H7.5 V12.5 H1.5 Z',
    right: 'M12.5 7.5 H18.5 V12.5 H12.5 Z',
  };
  const cross = { d: 'M7.5 1.5 H12.5 V7.5 H18.5 V12.5 H12.5 V18.5 H7.5 V12.5 H1.5 V7.5 H7.5 Z' };
  const el = svg('kit-g-dpad', cross);
  for (const arm of lit) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', arms[arm]);
    path.setAttribute('fill', 'currentColor');
    el.appendChild(path);
  }
  return el;
}

const DPAD: Readonly<Record<number, 'up' | 'down' | 'left' | 'right'>> = {
  [PAD_BUTTON.UP]: 'up',
  [PAD_BUTTON.DOWN]: 'down',
  [PAD_BUTTON.LEFT]: 'left',
  [PAD_BUTTON.RIGHT]: 'right',
};

/** Shoulders, triggers, sticks and the middle buttons: their names on each pad. */
const PAD_WORDS: Readonly<Record<number, readonly [string, string]>> = {
  [PAD_BUTTON.LB]: ['LB', 'L1'],
  [PAD_BUTTON.RB]: ['RB', 'R1'],
  [PAD_BUTTON.LT]: ['LT', 'L2'],
  [PAD_BUTTON.RT]: ['RT', 'R2'],
  [PAD_BUTTON.SELECT]: ['View', 'Create'],
  [PAD_BUTTON.START]: ['Menu', 'Options'],
  [PAD_BUTTON.L3]: ['LS', 'L3'],
  [PAD_BUTTON.R3]: ['RS', 'R3'],
  [PAD_BUTTON.HOME]: ['Home', 'PS'],
};

/** One pad button as a glyph, Xbox (`ps` false) or PlayStation. */
export function padGlyph(button: number, ps: boolean): HTMLElement {
  const face = FACE_NAMES[button];
  if (face !== undefined) {
    return h(
      'span.kit-g-face',
      { class: `kit-g-${face}` },
      ps ? svg('kit-g-shape', { d: PS_SHAPES[button] ?? '' }) : (XBOX_FACES[button] ?? ''),
    );
  }
  const arm = DPAD[button];
  if (arm !== undefined) return h('span.kit-g-pad', {}, dpad([arm]));
  const words = PAD_WORDS[button];
  const word = words?.[ps ? 1 : 0] ?? `B${button}`;
  const cls = button === PAD_BUTTON.LT || button === PAD_BUTTON.RT ? 'kit-g-trigger' : 'kit-g-shoulder';
  return h('span.kit-g-word', { class: cls }, word);
}

/** A key as a keycap. */
export function keyGlyph(key: string): HTMLElement {
  const label = keyLabel(key);
  return h('span.kit-g-key', { class: label.length > 1 && !/^[←→↑↓]$/.test(label) ? 'wide' : undefined }, label);
}

/** Glyph options: `pad` / `keys` replace the actions' own (e.g. a stepper's arrows). */
export type GlyphOpts = { keys?: readonly string[]; pad?: readonly number[] };

/**
 * The prompt chip for one or more actions (`glyph('confirm')`, `glyph(['prev', 'next'])`): keycaps
 * on a keyboard, pad glyphs on a pad, nothing on a touch screen. Two d-pad directions in one chip
 * draw one d-pad with both arms lit.
 */
export function glyph(actions: string | readonly string[], o: GlyphOpts = {}): HTMLElement {
  const list = typeof actions === 'string' ? [actions] : actions;
  const keys = o.keys ?? list.flatMap((a) => promptBinding(a).keys.slice(0, 1));
  const pad = o.pad ?? list.flatMap((a) => promptBinding(a).pad.slice(0, 1));
  const arms = pad.map((b) => DPAD[b]).filter((a) => a !== undefined);
  const padPart = (ps: boolean): HTMLElement[] =>
    arms.length === pad.length && arms.length > 1
      ? [h('span.kit-g-pad', {}, dpad(arms))]
      : pad.map((b) => padGlyph(b, ps));
  return h(
    'span.kit-glyph',
    {
      'aria-hidden': 'true',
      'data-glyph': list.join(' '),
      'data-keys': keys.length > 0 ? 'yes' : 'no',
      'data-pad': pad.length > 0 ? 'yes' : 'no',
    },
    h('span.kit-g-keys', {}, ...keys.map(keyGlyph)),
    h('span.kit-g-xbox', {}, ...padPart(false)),
    h('span.kit-g-ps', {}, ...padPart(true)),
  );
}

/** Where a control's chip goes: at its end (default), its start, or nowhere (`false`: bound, no chip). */
export type BindOpts = GlyphOpts & { chip?: 'end' | 'start' | false };

/**
 * Bind a control to an action: pressing the action's key or pad button presses it (on the current
 * screen or the top modal, outside active play: kit/input/prompts.ts), and it shows the chip.
 * Binding it again replaces the chip.
 */
export function bindAction<E extends HTMLElement>(el: E, action: string, o: BindOpts = {}): E {
  el.setAttribute('data-action', action);
  if (o.keys !== undefined) el.setAttribute('data-action-keys', o.keys.join(','));
  if (o.pad !== undefined) el.setAttribute('data-action-pad', o.pad.join(','));
  for (const old of el.querySelectorAll(':scope > .kit-glyph')) old.remove();
  if (o.chip === false) {
    el.setAttribute('data-chip', 'off');
    return el;
  }
  el.removeAttribute('data-chip');
  addChip(el, o);
  return el;
}

/** Put the chip of `el`'s action on it (again: after a game rebuilt its contents). */
function addChip(el: HTMLElement, o: BindOpts = {}): void {
  const action = el.getAttribute('data-action');
  if (action === null) return;
  const b = bindingOf(el);
  const chip = glyph(action, { keys: o.keys ?? b?.keys.slice(0, 1), pad: o.pad ?? b?.pad.slice(0, 1) });
  chip.classList.add('kit-glyph-on');
  if (o.chip === 'start') el.prepend(chip);
  else el.appendChild(chip);
}

/**
 * The kit's own controls and the actions they answer to, by test id (`screen/testid` first, then
 * `testid`): `bindKitControls` binds them as the kit's screens and modals appear.
 */
export const KIT_ACTIONS: Readonly<Record<string, string>> = {
  play: 'confirm',
  resume: 'back',
  restart: 'alt',
  settings: 'alt2',
  'play-again': 'confirm',
  'result/quit': 'back',
  'confirm-yes': 'confirm',
  'confirm-no': 'back',
  'howto-ok': 'confirm',
  'settings-close': 'back',
  'share-copy': 'confirm',
  'share-close': 'back',
  'lobby-start': 'confirm',
  'lobby-leave': 'back',
  'lobby-invite': 'alt2',
  'loading-leave': 'back',
  'online-play-now': 'confirm',
  'online-friends': 'alt',
  'online-who-back': 'back',
  'turns-start': 'confirm',
  'turns-rematch': 'confirm',
  'turns-back': 'back',
  'turns-who-back': 'back',
  'turns-invite-back': 'back',
};

/**
 * Bind the kit's controls under `root` (`KIT_ACTIONS`; a control already bound keeps its own), and
 * give a bound control whose contents were rebuilt its chip back (`data-chip="off"`: none wanted).
 */
export function bindKitControls(root: ParentNode, screen: string): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-testid]:not([data-action])')) {
    const id = el.getAttribute('data-testid') ?? '';
    const action = KIT_ACTIONS[`${screen}/${id}`] ?? KIT_ACTIONS[id];
    if (action !== undefined && el.matches('button, a[href], [role="button"]')) bindAction(el, action);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-action]:not([data-chip="off"])')) {
    if (el.querySelector(':scope > .kit-glyph') === null && el.matches('button, a[href], [role="button"]')) addChip(el);
  }
}
