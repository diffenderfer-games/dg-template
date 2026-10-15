/**
 * The game's controls: one declaration for keys, gamepad, mouse and touch. (GAME: yours to edit.)
 *
 * The hub draws the on-screen controls and maps gamepads (docs/hub.md "Input
 * system"). The kit enables `play` only while playing. Keep the `pause` input:
 * the kit pauses on it (Escape, P, the gamepad's Start).
 */
import type { VirtualDef } from '@diffenderfer-games/hub';
import type { InputSpec } from '../kit/input/index.ts';

/** The touch layout for a viewport width (phones get a smaller stick). TODO(game): your on-screen controls. */
function virtual(width: number): VirtualDef[] {
  const small = width < 520;
  return [{ id: 'move', type: 'joystick', place: 'bottom-left', size: small ? 120 : 150 }];
}

/** TODO(game): your inputs. `move` is read with `hub.input.vector('move')`. */
export const controls: InputSpec = {
  groups: {
    play: {
      inputs: {
        left: { keys: ['a', 'arrowleft'], gamepad: { axis: [0, '-'] }, touch: { stick: 'move', axis: 'x-' } },
        right: { keys: ['d', 'arrowright'], gamepad: { axis: [0, '+'] }, touch: { stick: 'move', axis: 'x+' } },
        up: { keys: ['w', 'arrowup'], gamepad: { axis: [1, '-'] }, touch: { stick: 'move', axis: 'y-' } },
        down: { keys: ['s', 'arrowdown'], gamepad: { axis: [1, '+'] }, touch: { stick: 'move', axis: 'y+' } },
        pause: { keys: ['escape', 'p'], gamepad: { button: 9 } },
      },
      axes: { move: { x: ['left', 'right'], y: ['up', 'down'] } },
    },
  },
  virtual,
};
