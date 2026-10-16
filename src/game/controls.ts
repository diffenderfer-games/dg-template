/**
 * The game's controls: one declaration for keys, gamepad, mouse and touch. (GAME: yours to edit.)
 *
 * The hub draws the on-screen controls and maps gamepads (docs/hub.md "Input
 * system", docs/kit/input.md). The kit enables `play` only while playing.
 * Keep the `pause` input: the kit pauses on it (Escape, the gamepad's Start).
 * Don't put letters on `pause`: a word game types them.
 */
import type { VirtualDef } from '@diffenderfer-games/hub';
import type { InputSpec } from '../kit/input/index.ts';

/** The touch layout for a viewport width (phones get a smaller button). TODO(game): your on-screen controls. */
function virtual(width: number): VirtualDef[] {
  return [{ id: 'act', type: 'button', place: 'bottom-right', size: width < 520 ? 96 : 120, label: 'Score' }];
}

/** TODO(game): your inputs. `action` is read with `hub.input.value('action')`. */
export const controls: InputSpec = {
  groups: {
    play: {
      inputs: {
        action: { keys: [' '], gamepad: { button: 0 }, touch: { button: 'act' } },
        pause: { keys: ['escape'], gamepad: { button: 9 } },
      },
    },
  },
  virtual,
};
