// @vitest-environment jsdom
/**
 * A gamepad through the REAL hub input system (kit/testing fake-pad) and the kit's controls and menu
 * navigation: what a game can rely on (stick dead zones that rescale, button lists, a light trigger
 * squeeze makes the pad the active device, Start resumes from the pause screen), and the kit's menus
 * staying out of play when A and B are the game's.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NAV_FOCUS_ATTRIBUTE, PAD_BUTTON } from '@diffenderfer-games/hub/input';
import {
  defineControls,
  installMenuNav,
  navTargets,
  RESUME_INPUT,
  type InputSpec,
} from '../../../src/kit/input/index.ts';
import { createFakeHub, padHarness, type PadHarness } from '../../../src/kit/testing/index.ts';

const spec: InputSpec = {
  groups: {
    play: {
      inputs: {
        left: { keys: ['a'], gamepad: { axis: [0, '-'], button: [PAD_BUTTON.LEFT, PAD_BUTTON.LB] } },
        right: { keys: ['d'], gamepad: { axis: [0, '+'], button: PAD_BUTTON.RIGHT } },
        raw: { gamepad: { axis: [0, '+'], deadzone: 0 } },
        gas: { gamepad: { button: PAD_BUTTON.RT } },
        use: { keys: [' '], gamepad: { button: PAD_BUTTON.A } },
        pause: { keys: ['escape'], gamepad: { button: PAD_BUTTON.START } },
      },
    },
  },
};

let h: PadHarness;

beforeEach(() => {
  document.body.replaceChildren();
  h = padHarness();
});

afterEach(() => h.dispose());

function playing(): ReturnType<typeof defineControls> {
  const controls = defineControls({ input: h.input }, spec, 1280);
  controls.sync({ playing: true });
  return controls;
}

describe('the fake pad drives the real hub', () => {
  it('a light trigger squeeze makes the pad the active device and reads analog', () => {
    playing();
    h.frame();
    expect(h.input.source).toBe('keyboard');
    h.pad.press(PAD_BUTTON.RT, 0.3);
    h.frame();
    expect(h.input.source).toBe('gamepad');
    expect(h.input.value('gas')).toBeCloseTo(0.3);
  });

  it('a stick rises smoothly from its dead zone; deadzone 0 reads it raw', () => {
    playing();
    h.activate();
    let last = 0;
    for (let x = 0; x <= 1.0001; x += 0.05) {
      h.pad.stick(x);
      h.frame();
      const value = h.input.value('right');
      expect(value).toBeGreaterThanOrEqual(last);
      expect(value - last).toBeLessThan(0.1);
      last = value;
    }
    expect(last).toBeCloseTo(1);
    h.pad.stick(0.08);
    h.frame();
    expect(h.input.value('right')).toBe(0);
    expect(h.input.value('raw')).toBeCloseTo(0.08);
  });

  it('one input reads a stick and several buttons', () => {
    playing();
    h.activate();
    h.pad.press(PAD_BUTTON.LB);
    h.frame();
    expect(h.input.value('left')).toBe(1);
    h.pad.release().press(PAD_BUTTON.LEFT);
    h.frame();
    expect(h.input.value('left')).toBe(1);
    h.pad.release().stick(-1);
    h.frame();
    expect(h.input.value('left')).toBe(1);
  });

  it('Start resumes from the pause screen: the kit:resume group reads the pause button', () => {
    const controls = playing();
    h.activate();
    controls.sync({ playing: false, paused: true });
    h.pad.press(PAD_BUTTON.START);
    h.frame();
    expect(h.input.value('pause')).toBe(0); // play is off
    expect(h.input.value(RESUME_INPUT)).toBe(1);
    controls.sync({ playing: true, paused: false });
    h.frame();
    expect(h.input.value(RESUME_INPUT)).toBe(0);
  });
});

describe("the kit's menus with a real pad", () => {
  /** A screen of [data-nav] buttons (a HUD's pause in play, a menu otherwise). */
  function screen(names: readonly string[], clicks: string[]): HTMLElement {
    const root = document.createElement('div');
    for (const [i, name] of names.entries()) {
      const b = document.createElement('button');
      b.setAttribute('data-nav', '');
      b.textContent = name;
      b.onclick = () => clicks.push(name);
      b.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: i * 60, width: 200, height: 50 });
      root.append(b);
    }
    document.body.append(root);
    return root;
  }

  it("in play with A the game's, A is USE only: the HUD's pause is never clicked", () => {
    const controls = playing();
    const clicks: string[] = [];
    const root = screen(['pause'], clicks);
    let inPlay = true;
    const hub = { input: h.input, overlay: createFakeHub({ events: new EventTarget() }).overlay };
    installMenuNav(hub, {
      root,
      back: () => true,
      active: () => !(inPlay && controls.usesPadButton([...h.input.padButtons.act, ...h.input.padButtons.back])),
    });
    h.pad.press(PAD_BUTTON.A);
    h.frame(3);
    expect(clicks).toEqual([]);
    expect(h.input.value('use')).toBe(1);
    h.pad.release();
    h.frame();
    inPlay = false;
    h.pad.press(PAD_BUTTON.A);
    h.frame(2);
    expect(clicks).toEqual(['pause']);
  });

  it("the kit's focus: no hub ring, and the highlighted control carries data-hub-focus", () => {
    playing();
    const clicks: string[] = [];
    const root = screen(['race', 'settings'], clicks);
    const hub = { input: h.input, overlay: createFakeHub({ events: new EventTarget() }).overlay };
    installMenuNav(hub, { root, back: () => true });
    h.activate();
    h.frame();
    const [first, second] = navTargets(root);
    expect(first?.hasAttribute(NAV_FOCUS_ATTRIBUTE)).toBe(true);
    const ring = document.getElementById('hub-input-root')?.shadowRoot?.querySelector<HTMLElement>('.ring');
    expect(ring?.hidden).toBe(true);
    h.pad.press(PAD_BUTTON.DOWN);
    h.frame();
    expect(second?.hasAttribute(NAV_FOCUS_ATTRIBUTE)).toBe(true);
    expect(first?.hasAttribute(NAV_FOCUS_ATTRIBUTE)).toBe(false);
  });
});
