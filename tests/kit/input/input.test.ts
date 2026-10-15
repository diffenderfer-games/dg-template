// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { controlHints, defineControls, navTargets, repeatPress, setHudInsets } from '../../../src/kit/input/index.ts';
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
