// @vitest-environment jsdom
/**
 * Button prompts (kit/input/glyphs.ts, prompts.ts) with the REAL hub input system and a fake pad:
 * the chips follow the device (keys, an Xbox or PlayStation pad, touch), bound controls answer to
 * their keys and pad buttons, only in the top modal, never during active play, and never for the
 * hub's own buttons; Back presses the `back` control; steppers step on left and right.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PAD_BUTTON } from '@diffenderfer-games/hub/input';
import {
  axisControl,
  bindAction,
  defineControls,
  glyph,
  installMenuNav,
  installPrompts,
  keyLabel,
  navTargets,
  padStyleOf,
  promptBinding,
  promptMode,
  setPromptBindings,
} from '../../../src/kit/input/index.ts';
import { createFakeHub, padHarness, type PadHarness } from '../../../src/kit/testing/index.ts';
import { button } from '../../../src/kit/ui/controls.ts';
import { closeTopModal, openModal } from '../../../src/kit/ui/modal.ts';
import { mountUi } from '../../../src/kit/ui/root.ts';

let h: PadHarness;
let root: HTMLElement;
let offs: (() => void)[] = [];
let inPlay = false;

function setup(o: { id?: string } = {}): void {
  h = padHarness(o.id === undefined ? {} : { id: o.id });
  // (a game defines its inputs: the hub's zero-config fallback, which types keys for the pad, stands down)
  defineControls({ input: h.input }, { groups: { play: { inputs: { use: { keys: [' '] } } } } }, 1280);
  const hub = { input: h.input, overlay: createFakeHub({ events: new EventTarget() }).overlay };
  offs.push(installPrompts(hub, { root, active: () => !inPlay }));
  offs.push(installMenuNav(hub, { root, back: () => false, active: () => !inPlay }));
}

/** A bound button, stacked down the screen (rects for the spatial moves). */
function bound(label: string, action: string | null, clicks: string[], into: HTMLElement = root): HTMLButtonElement {
  const b = button(label, () => clicks.push(label), action === null ? {} : { action });
  const i = into.querySelectorAll('[data-nav]').length;
  b.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: i * 60, width: 200, height: 50 });
  into.append(b);
  return b;
}

const key = (k: string, target: EventTarget = window): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
};

/** Press and let go of a pad button, a hub frame each. */
function tap(button: number): void {
  h.pad.press(button);
  h.frame();
  h.pad.press(button, 0);
  h.frame();
}

beforeEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.prompts;
  delete document.documentElement.dataset.padStyle;
  root = document.createElement('div');
  root.className = 'kit-ui';
  document.body.append(root);
  mountUi(root);
  inPlay = false;
  setPromptBindings({});
});

afterEach(() => {
  while (closeTopModal());
  offs.forEach((off) => off());
  offs = [];
  h.dispose();
});

describe('the chips', () => {
  it('hold a keycap, an Xbox glyph and a PlayStation glyph', () => {
    setup();
    const chip = glyph('confirm');
    expect(chip.querySelector('.kit-g-keys')?.textContent).toBe('Enter');
    expect(chip.querySelector('.kit-g-xbox')?.textContent).toBe('A');
    expect(chip.querySelector('.kit-g-ps svg')).not.toBeNull();
    expect(glyph(['prev', 'next']).querySelector('.kit-g-xbox')?.textContent).toBe('LBRB');
    expect(glyph(['prev', 'next']).querySelector('.kit-g-ps')?.textContent).toBe('L1R1');
    expect(glyph(['left', 'right']).querySelectorAll('.kit-g-xbox .kit-g-dpad')).toHaveLength(1);
    expect(keyLabel('Escape')).toBe('Esc');
    expect(keyLabel(' ')).toBe('Space');
    expect(keyLabel('q')).toBe('Q');
  });

  it('a game changes a binding, and a chip shows it', () => {
    setup();
    setPromptBindings({ alt: { keys: ['x'] }, swap: { keys: ['s'], pad: [PAD_BUTTON.Y] } });
    expect(promptBinding('alt')).toEqual({ keys: ['x'], pad: [PAD_BUTTON.X] });
    expect(glyph('swap').querySelector('.kit-g-keys')?.textContent).toBe('S');
  });

  it('a bound control carries one chip, put back after its contents are rebuilt', async () => {
    setup();
    const b = bound('Go', 'confirm', []);
    expect(b.querySelectorAll('.kit-glyph')).toHaveLength(1);
    bindAction(b, 'confirm');
    expect(b.querySelectorAll('.kit-glyph')).toHaveLength(1);
    document.documentElement.dataset.prompts = 'keys';
    root.dataset.screen = 'title';
    b.replaceChildren('Go');
    await Promise.resolve();
    await Promise.resolve();
    expect(b.querySelectorAll('.kit-glyph')).toHaveLength(1);
  });

  it("the kit's own controls get their actions as they appear", async () => {
    setup();
    root.dataset.screen = 'result';
    const again = document.createElement('button');
    again.setAttribute('data-testid', 'play-again');
    const quit = document.createElement('button');
    quit.setAttribute('data-testid', 'quit');
    root.append(again, quit);
    await Promise.resolve();
    await Promise.resolve();
    expect(again.getAttribute('data-action')).toBe('confirm');
    expect(quit.getAttribute('data-action')).toBe('back');
    expect(again.querySelector('.kit-glyph')).not.toBeNull();
  });
});

describe('the chips follow the device', () => {
  it('keys at first; a pad shows Xbox glyphs; a key brings the keycaps back; a finger hides them', () => {
    setup();
    expect(promptMode()).toBe('keys');
    tap(PAD_BUTTON.HOME);
    expect(promptMode()).toBe('pad');
    expect(document.documentElement.dataset.padStyle).toBe('xbox');
    key('Shift');
    expect(promptMode()).toBe('pad');
    key('a');
    expect(promptMode()).toBe('keys');
    tap(PAD_BUTTON.HOME);
    expect(promptMode()).toBe('pad');
    const touch = new Event('pointerdown');
    Object.defineProperty(touch, 'pointerType', { value: 'touch' });
    window.dispatchEvent(touch);
    expect(promptMode()).toBe('none');
  });

  it('a PlayStation pad shows its own glyphs', () => {
    setup({ id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)' });
    tap(PAD_BUTTON.HOME);
    expect(document.documentElement.dataset.padStyle).toBe('ps');
    expect(padStyleOf('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)')).toBe('xbox');
    expect(padStyleOf('Sony PLAYSTATION(R)3 Controller')).toBe('ps');
  });
});

describe('bindings press their controls', () => {
  it('keys: Q, E, F, R press their controls; Enter presses confirm only when no control has focus', () => {
    setup();
    const clicks: string[] = [];
    const go = bound('Go', 'confirm', clicks);
    bound('Prev', 'prev', clicks);
    bound('Next', 'next', clicks);
    bound('Swap', 'alt', clicks);
    const other = bound('Other', null, clicks);
    key('q');
    key('E');
    key('f');
    key('Enter');
    expect(clicks).toEqual(['Prev', 'Next', 'Swap', 'Go']);
    other.focus();
    key('Enter', other);
    expect(clicks).toHaveLength(4);
    go.disabled = true;
    other.blur();
    key('Enter');
    expect(clicks).toHaveLength(4);
  });

  it('pad: X, Y, LB, RB, LT, RT press theirs; A and B stay the hub navigation’s', () => {
    setup();
    const clicks: string[] = [];
    bound('Go', 'confirm', clicks);
    bound('Back', 'back', clicks);
    bound('Swap', 'alt', clicks);
    bound('Random', 'alt2', clicks);
    bound('Prev', 'prev', clicks);
    bound('Next', 'next', clicks);
    bound('Colour-', 'page-prev', clicks);
    bound('Colour+', 'page-next', clicks);
    h.activate();
    for (const b of [PAD_BUTTON.X, PAD_BUTTON.Y, PAD_BUTTON.LB, PAD_BUTTON.RB, PAD_BUTTON.LT, PAD_BUTTON.RT]) tap(b);
    expect(clicks).toEqual(['Swap', 'Random', 'Prev', 'Next', 'Colour-', 'Colour+']);
    clicks.length = 0;
    // A: the hub clicks the highlighted control, the confirm one first; B: the kit's back presses `back`.
    tap(PAD_BUTTON.A);
    tap(PAD_BUTTON.B);
    expect(clicks).toEqual(['Go', 'Back']);
  });

  it('the top modal only: the screen behind answers to nothing', () => {
    setup();
    const clicks: string[] = [];
    bound('Screen swap', 'alt', clicks);
    const yes = button('Yes', () => clicks.push('Yes'), { action: 'alt' });
    openModal({
      title: 'Sure?',
      body: yes,
      buttons: [{ label: 'No', action: 'back', onClick: () => clicks.push('No') }],
    });
    key('f');
    h.activate();
    tap(PAD_BUTTON.X);
    key('Escape');
    expect(clicks).toEqual(['Yes', 'Yes', 'No']);
    key('f');
    expect(clicks).toEqual(['Yes', 'Yes', 'No', 'Screen swap']);
  });

  it('never during active play', () => {
    setup();
    const clicks: string[] = [];
    bound('Restart', 'alt2', clicks);
    inPlay = true;
    key('r');
    h.activate();
    tap(PAD_BUTTON.Y);
    expect(clicks).toEqual([]);
    inPlay = false;
    key('r');
    expect(clicks).toEqual(['Restart']);
  });

  it('Esc and B press the back control; with none, the screen’s own back', () => {
    setup();
    const clicks: string[] = [];
    bound('Back', 'back', clicks);
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(e);
    expect(clicks).toEqual(['Back']);
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('steppers and arrows', () => {
  it('left and right step a focused stepper (arrows, the d-pad); Enter and A confirm', () => {
    setup();
    const clicks: string[] = [];
    const steps: number[] = [];
    const row = axisControl(document.createElement('div'), (d) => steps.push(d));
    row.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 60 });
    root.append(row);
    const go = bound('Go', 'confirm', clicks);
    go.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 100, width: 300, height: 50 });
    row.focus();
    key('ArrowRight', row);
    key('ArrowLeft', row);
    expect(steps).toEqual([1, -1]);
    key('Enter', row);
    expect(clicks).toEqual(['Go']);
    h.activate();
    row.focus();
    tap(PAD_BUTTON.RIGHT);
    expect(steps).toEqual([1, -1, 1]);
    expect(navTargets(root)).toContain(go);
  });

  it('left and right move a focused slider (the keys and the d-pad)', () => {
    setup();
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '50';
    slider.setAttribute('data-nav', '');
    const moved: string[] = [];
    slider.addEventListener('input', () => moved.push(slider.value));
    root.append(slider);
    bound('Below', null, []);
    slider.focus();
    key('ArrowRight', slider);
    expect(document.activeElement).toBe(slider);
    h.activate();
    slider.focus();
    tap(PAD_BUTTON.LEFT);
    expect(moved).toEqual(['55', '50']);
  });

  it('arrows move focus between the controls, in screen order', () => {
    setup();
    const clicks: string[] = [];
    const a = bound('One', null, clicks);
    const b = bound('Two', null, clicks);
    key('ArrowDown');
    expect(document.activeElement).toBe(a);
    key('ArrowDown', a);
    expect(document.activeElement).toBe(b);
    key('ArrowUp', b);
    expect(document.activeElement).toBe(a);
  });
});
