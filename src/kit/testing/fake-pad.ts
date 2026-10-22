/**
 * kit/testing: a fake standard gamepad driving the REAL hub input system. Tests only (jsdom).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "A gamepad through the real hub"
 *
 *   const pad = padHarness();                   // a real InputSystem, a fake pad plugged in
 *   defineControls({ input: pad.input }, controls, 1280).sync({ playing: true });
 *   pad.pad.press(PAD_BUTTON.RT, 0.8).stick(0.4);
 *   pad.frame();                                // one hub frame: the hub reads the pad
 *   expect(pad.input.value('throttle')).toBeCloseTo(0.8);
 *   pad.dispose();
 *
 * The hub's frames run by hand (`frame(n)`), so nothing depends on timing.
 */
import { InputSystem } from '@diffenderfer-games/hub/input';

const BUTTONS = 17;

class FakeButton implements GamepadButton {
  pressed = false;
  touched = false;
  value = 0;
}

/** A standard gamepad: hold buttons (`press`, triggers 0..1) and push sticks (`stick`, `rightStick`). */
export class FakePad implements Pick<
  Gamepad,
  'id' | 'index' | 'connected' | 'mapping' | 'timestamp' | 'axes' | 'buttons'
> {
  /** The browser's name for it (a PlayStation pad's has "DualSense" or "054c" in it). */
  readonly id: string;
  readonly index: number;
  readonly connected = true;
  readonly mapping = 'standard';
  readonly timestamp = 0;
  axes: number[] = [0, 0, 0, 0];
  readonly buttons: FakeButton[] = Array.from({ length: BUTTONS }, () => new FakeButton());

  constructor(index = 0, id = 'Fake pad (STANDARD GAMEPAD)') {
    this.index = index;
    this.id = id;
  }

  /** Hold button `i` (a trigger: `value` 0..1, pressed from 0.5). `value` 0 lets go. */
  press(i: number, value = 1): this {
    const b = this.buttons[i];
    if (b) {
      b.value = value;
      b.pressed = value >= 0.5;
      b.touched = value > 0;
    }
    return this;
  }

  /** Let go of everything. */
  release(): this {
    for (const b of this.buttons) {
      b.value = 0;
      b.pressed = false;
      b.touched = false;
    }
    this.axes = [0, 0, 0, 0];
    return this;
  }

  /** Push the left stick (x right, y down; −1..1). */
  stick(x: number, y = 0): this {
    this.axes = [x, y, this.axes[2] ?? 0, this.axes[3] ?? 0];
    return this;
  }

  /** Push the right stick. */
  rightStick(x: number, y = 0): this {
    this.axes = [this.axes[0] ?? 0, this.axes[1] ?? 0, x, y];
    return this;
  }
}

/** Make `navigator.getGamepads()` return these pads (with a hole first, like a browser's list). Returns the unplug. */
export function plugIn(...pads: FakePad[]): () => void {
  const list: (FakePad | null)[] = [null, ...pads];
  Object.defineProperty(navigator, 'getGamepads', { value: () => list, configurable: true, writable: true });
  return () => {
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true, writable: true });
  };
}

/** A real hub input system with a fake pad, its frames run by hand. */
export type PadHarness = {
  readonly input: InputSystem;
  /** The first pad. */
  readonly pad: FakePad;
  readonly pads: readonly FakePad[];
  /** Run `n` hub frames (default 1): each reads the pads and updates every input. */
  frame(n?: number): void;
  /** Make the pad the active device (a press and a release of a button nobody reads, or `button`). */
  activate(button?: number): void;
  /** Unplug the pads and give `requestAnimationFrame` back. */
  dispose(): void;
};

/** Plug `count` fake pads into a new real `InputSystem` (slug `game`), with the hub's frames run by hand. */
export function padHarness(o: { count?: number; slug?: string; id?: string } = {}): PadHarness {
  let frames: FrameRequestCallback[] = [];
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => {
    frames.push(cb);
    return frames.length;
  };
  const pads = Array.from({ length: Math.max(1, o.count ?? 1) }, (_, i) => new FakePad(i, o.id));
  const unplug = plugIn(...pads);
  const input = new InputSystem({ slug: o.slug ?? 'game', loadOverrides: () => null, saveOverrides: () => undefined });
  const frame = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      const due = frames;
      frames = [];
      for (const cb of due) cb(performance.now());
    }
  };
  const pad = pads[0] ?? new FakePad();
  return {
    input,
    pad,
    pads,
    frame,
    activate(button = 16) {
      pad.press(button);
      frame();
      pad.press(button, 0);
      frame();
    },
    dispose() {
      unplug();
      globalThis.requestAnimationFrame = raf;
    },
  };
}
