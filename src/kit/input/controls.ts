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
 */
import type { GroupDef, VirtualDef } from '@diffenderfer-games/hub';
import type { HubLike } from '../core/hub-like.ts';

/** What the game declares (src/game/controls.ts). */
export type InputSpec = {
  /** Every group; `play` is the one enabled during play. */
  groups: Record<string, GroupDef>;
  /** The `play` group's on-screen controls for a viewport width (default: the group's own `virtual`). */
  virtual?: (width: number) => VirtualDef[];
};

/** The defined controls. */
export type ControlsHandle = {
  /** Enable `play` while playing, plus any `extra` groups; hub calls only on change. */
  sync(state: { playing: boolean; extra?: Record<string, boolean> }): void;
  /** Re-define the touch layout if the width changed it (resize, rotation). */
  relayout(width: number): void;
  /** Does an enabled group read this key (`KeyboardEvent.key`, any case)? Then the key is the game's (Esc in the world's box). */
  usesKey(key: string): boolean;
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
  };
}
