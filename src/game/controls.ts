/**
 * The game's controls: one declaration for keys, gamepad, mouse and touch. (GAME: yours to edit.)
 *
 * The hub draws the on-screen controls and maps gamepads (docs/hub.md "Input
 * system", docs/kit/input.md). The kit enables `play` only while playing.
 * Keep the `pause` input: the kit pauses on it (Escape, the gamepad's Start).
 * Don't put letters on `pause`: a word game types them (docs/kit/input.md § "Typing and word games").
 */
import type { VirtualDef } from '@diffenderfer-games/hub';
import type { InputSpec } from '../kit/input/index.ts';

/**
 * The touch layout for a viewport width. TODO(game): your on-screen controls, e.g.
 * `[{ id: 'move', type: 'joystick', place: 'bottom-left', size: width < 520 ? 120 : 150 }]`.
 */
function virtual(_width: number): VirtualDef[] {
  return [];
}

/**
 * TODO(game): your inputs, read in hooks.ts `step` with `ctx.hub.input`. For example:
 *   jump: { keys: [' '], gamepad: { button: 0 }, touch: { button: 'jump' } },   // value('jump')
 *   left: { keys: ['a', 'arrowleft'], gamepad: { axis: [0, '-'] }, touch: { stick: 'move', axis: 'x-' } },
 * and `axes: { move: { x: ['left', 'right'], y: ['up', 'down'] } }` for `vector('move')`.
 */
export const controls: InputSpec = {
  groups: {
    play: {
      inputs: {
        pause: { keys: ['escape'], gamepad: { button: 9 } },
      },
    },
  },
  virtual,
};
