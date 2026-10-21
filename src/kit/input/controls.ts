/**
 * kit/input: the game's input groups, enabled only on change, with width-dependent touch layouts.
 * Source: dg-template src/kit/input/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/input.md
 *
 * - `sync({ playing })` enables `play` only while playing and calls the hub only
 *   when something changed (quanta syncControls); while hub UI is open the hub
 *   records it and applies the last one on close.
 * - `virtual(width)` gives the on-screen controls for a width (GD
 *   virtualControls); `relayout()` re-defines them when the layout changes.
 * - `sync({ paused: true })` enables the kit's own `kit:resume` group: the
 *   `pause` input's keys and buttons, so Start (or Esc) resumes from the
 *   pause screen as it paused.
 */
import type { GamepadMapping, GroupDef, InputDef, VirtualDef } from '@diffenderfer-games/hub';
import type { HubLike } from '../core/hub-like.ts';

/** What the game declares (src/game/controls.ts). */
export type InputSpec = {
  /** Every group; `play` is the one enabled during play. */
  groups: Record<string, GroupDef>;
  /** The `play` group's on-screen controls for a viewport width (default: the group's own `virtual`). */
  virtual?: (width: number) => VirtualDef[];
};

/** The kit's group while paused: the `pause` input's keys and buttons again, read as `RESUME_INPUT`. */
export const RESUME_GROUP = 'kit:resume';
export const RESUME_INPUT = 'kit:resume';

/** A gamepad mapping's buttons as a list. */
export function padButtonsOf(mapping: GamepadMapping | undefined): readonly number[] {
  const button = mapping?.button;
  return button === undefined ? [] : typeof button === 'number' ? [button] : button;
}

/** The defined controls. */
export type ControlsHandle = {
  /** Enable `play` while playing (and `kit:resume` while paused), plus any `extra` groups; hub calls only on change. */
  sync(state: { playing: boolean; paused?: boolean; extra?: Record<string, boolean> }): void;
  /** Re-define the touch layout if the width changed it (resize, rotation). */
  relayout(width: number): void;
  /** Does an enabled group read this key (`KeyboardEvent.key`, any case)? Then the key is the game's (Esc in the world's box). */
  usesKey(key: string): boolean;
  /** Does a group (default `play`, enabled or not) read any of these gamepad buttons? */
  usesPadButton(buttons: readonly number[], group?: string): boolean;
};

/** Define the game's controls with the hub. */
export function defineControls(hub: Pick<HubLike, 'input'>, spec: InputSpec, width: number): ControlsHandle {
  const enabled = new Map<string, boolean>();
  let layout: VirtualDef[] | null = null;

  const define = (w: number): void => {
    const next = spec.virtual?.(w) ?? null;
    if (layout !== null && JSON.stringify(next) === JSON.stringify(layout)) return;
    layout = next;
    const groups: Record<string, GroupDef> = {};
    for (const [name, g] of Object.entries(spec.groups)) {
      groups[name] =
        name === 'play' && next !== null
          ? { ...g, virtual: next, enabled: enabled.get(name) ?? false }
          : { ...g, enabled: enabled.get(name) ?? false };
    }
    const pause = spec.groups['play']?.inputs['pause'];
    if (pause !== undefined && !(RESUME_GROUP in groups)) groups[RESUME_GROUP] = resumeGroup(pause, enabled);
    hub.input.define({ groups });
  };
  define(width);

  const set = (group: string, on: boolean): void => {
    if (enabled.get(group) === on) return;
    enabled.set(group, on);
    if (on) hub.input.enable(group);
    else hub.input.disable(group);
  };

  return {
    sync(state) {
      set('play', state.playing);
      if (spec.groups['play']?.inputs['pause'] !== undefined) set(RESUME_GROUP, state.paused === true);
      for (const [group, on] of Object.entries(state.extra ?? {})) set(group, on);
    },
    relayout: define,
    usesKey(key) {
      const k = key.toLowerCase();
      return Object.entries(spec.groups).some(
        ([name, g]) =>
          enabled.get(name) === true &&
          Object.values(g.inputs).some((def) => def.keys?.some((bound) => bound.toLowerCase() === k) === true),
      );
    },
    usesPadButton(buttons, group = 'play') {
      const inputs = Object.values(spec.groups[group]?.inputs ?? {});
      return inputs.some((def) => padButtonsOf(def.gamepad).some((b) => buttons.includes(b)));
    },
  };
}

/** The pause screen's resume: the `pause` input's keys and pad buttons (no touch: the pause screen has a button). */
function resumeGroup(pause: InputDef, enabled: Map<string, boolean>): GroupDef {
  const input: InputDef = {
    ...(pause.keys === undefined ? {} : { keys: pause.keys }),
    ...(pause.gamepad === undefined ? {} : { gamepad: pause.gamepad }),
  };
  return { inputs: { [RESUME_INPUT]: input }, enabled: enabled.get(RESUME_GROUP) ?? false };
}
