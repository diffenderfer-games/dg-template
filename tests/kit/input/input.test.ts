// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  controlHints,
  defineControls,
  installMenuNav,
  navTargets,
  padButtonsOf,
  repeatPress,
  RESUME_GROUP,
  RESUME_INPUT,
  setHudInsets,
} from '../../../src/kit/input/index.ts';
import { closeTopModal, openModal } from '../../../src/kit/ui/modal.ts';
import { mountUi } from '../../../src/kit/ui/root.ts';
import { createFakeHub, type FakeHub } from '../../../src/kit/testing/index.ts';

let fake: FakeHub;
beforeEach(() => {
  fake = createFakeHub({ events: new EventTarget() });
  document.body.replaceChildren();
  mountUi();
  while (closeTopModal());
});

const spec = {
  groups: { play: { inputs: { a: { keys: ['a'] } } }, zone: { inputs: { b: { keys: ['b'] } } } },
  virtual: (w: number) => [
    { id: 'move', type: 'joystick' as const, place: 'bottom-left' as const, size: w < 520 ? 120 : 150 },
  ],
};

describe('controls: the pad', () => {
  const padSpec = {
    groups: {
      play: {
        inputs: {
          use: { gamepad: { button: [0, 4] } },
          pause: { keys: ['escape'], gamepad: { button: 9 }, touch: { button: 'pause' } },
        },
      },
      menu: { inputs: { back: { gamepad: { button: 1 } } } },
    },
  };

  it('usesPadButton: does a group (enabled or not; default play) read any of these buttons', () => {
    const c = defineControls(fake, padSpec, 1000);
    expect(c.usesPadButton([0, 1])).toBe(true);
    expect(c.usesPadButton([4])).toBe(true);
    expect(c.usesPadButton([1])).toBe(false);
    expect(c.usesPadButton([1], 'menu')).toBe(true);
    expect(padButtonsOf(undefined)).toEqual([]);
    expect(padButtonsOf({ button: 3 })).toEqual([3]);
  });

  it('a game with a pause input gets kit:resume (its keys and pad button, no touch), on only while paused', () => {
    const c = defineControls(fake, padSpec, 1000);
    const resume = fake.input.config?.groups[RESUME_GROUP];
    expect(resume?.inputs[RESUME_INPUT]).toEqual({ keys: ['escape'], gamepad: { button: 9 } });
    c.sync({ playing: true });
    expect(fake.input.isEnabled(RESUME_GROUP)).toBe(false);
    c.sync({ playing: false, paused: true });
    expect(fake.input.isEnabled(RESUME_GROUP)).toBe(true);
    expect(fake.input.isEnabled('play')).toBe(false);
  });

  it('installMenuNav: no targets while inactive; the ring is off unless asked for', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button data-nav>Pause</button>';
    document.body.append(root);
    let active = false;
    installMenuNav(fake, { root, back: () => true, active: () => active });
    expect(fake.input.nav?.targets()).toHaveLength(0);
    expect(fake.input.nav?.ring).toBe(false);
    active = true;
    expect(fake.input.nav?.targets()).toHaveLength(1);
    installMenuNav(fake, { root, back: () => true, ring: true });
    expect(fake.input.nav?.ring).toBe(true);
  });
});

describe('controls', () => {
  it('enable/disable only on change (quanta syncControls), extra groups one by one', () => {
    const c = defineControls(fake, spec, 1000);
    c.sync({ playing: true });
    c.sync({ playing: true });
    c.sync({ playing: false, extra: { zone: true } });
    expect(fake.log.names().filter((n) => n.startsWith('input.'))).toEqual([
      'input.define',
      'input.enable',
      'input.disable',
      'input.enable',
    ]);
  });

  it('usesKey: only the enabled groups read a key (any case)', () => {
    const c = defineControls(fake, spec, 1000);
    expect(c.usesKey('A')).toBe(false);
    c.sync({ playing: true });
    expect(c.usesKey('A')).toBe(true);
    expect(c.usesKey('b')).toBe(false);
    c.sync({ playing: false, extra: { zone: true } });
    expect(c.usesKey('a')).toBe(false);
    expect(c.usesKey('B')).toBe(true);
  });

  it('a sync while hub UI is open is recorded, then applied once it closes', () => {
    const c = defineControls(fake, spec, 1000);
    const close = fake.openOverlay();
    c.sync({ playing: true });
    expect(fake.input.isEnabled('play')).toBe(false);
    close();
    expect(fake.input.isEnabled('play')).toBe(true);
  });

  it('the touch layout switches at 520 px, and re-defines only when it changed (GD virtualControls)', () => {
    const c = defineControls(fake, spec, 1000);
    c.relayout(900);
    expect(fake.log.count('input.define')).toBe(1);
    c.relayout(400);
    expect(fake.log.count('input.define')).toBe(2);
    expect(fake.input.config?.groups.play?.virtual?.[0]?.size).toBe(120);
  });
});

describe('menu navigation', () => {
  it('targets the topmost modal, skipping hidden and disabled controls (bingo)', () => {
    const root = document.getElementById('ui') ?? document.body;
    const shown = Object.assign(document.createElement('button'), { textContent: 'screen' });
    shown.setAttribute('data-nav', '');
    root.appendChild(shown);
    const hidden = document.createElement('button');
    hidden.setAttribute('data-nav', '');
    hidden.hidden = true;
    root.appendChild(hidden);
    expect(navTargets(root)).toHaveLength(1);
    const m = openModal({ title: 'x', buttons: [{ label: 'One' }, { label: 'Two' }] });
    (m.el.querySelectorAll('button')[1] ?? hidden).setAttribute('disabled', '');
    expect(navTargets(root).map((b) => b.textContent)).toEqual(['One']);
  });

  it('control hints follow the source (weston controlHints)', () => {
    const seen: string[] = [];
    controlHints(fake, (k) => seen.push(k));
    fake.input.switchSource('touch');
    fake.input.switchSource('gamepad');
    expect(seen).toEqual(['keys', 'touch', 'pad']);
  });

  it('HUD insets keep touch controls off HUD bands (quanta syncControlInsets)', () => {
    const top = document.createElement('div');
    top.getBoundingClientRect = () => ({
      top: 0,
      bottom: 64,
      left: 0,
      right: 0,
      width: 0,
      height: 64,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    setHudInsets(fake, { top: [top] });
    expect(fake.input.insets).toEqual({ top: 64, bottom: 0 });
  });

  it('repeatPress: the press, then after the first delay, then at the repeat rate (solitaire pressed())', () => {
    let held = true;
    const r = repeatPress(() => held, { first: 300, next: 100 });
    const fired = [r(16), r(200), r(100), r(50), r(50)];
    expect(fired).toEqual([true, false, true, false, true]);
    held = false;
    expect(r(16)).toBe(false);
  });
});
