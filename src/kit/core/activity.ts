/**
 * kit/core: what the player is doing (normal play, a daily, a race, online).
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 *
 * One shared value that the guards read: a daily, a race or an online match
 * never touches normal progress (the profile, the boards, the Resume run).
 */

/** How the current game was started. */
export type PlayMode = 'normal' | 'daily' | 'race' | 'online';

/** The shared activity. */
export type Activity = {
  /** The current game's mode, or null on menus. */
  readonly mode: PlayMode | null;
  set(mode: PlayMode | null): void;
  /** Is normal progress off limits right now (a daily, a race or online play)? */
  isolated(): boolean;
  /** Called on every change; returns the unsubscribe. */
  on(cb: (mode: PlayMode | null) => void): () => void;
};

/** A fresh activity (menus). */
export function createActivity(): Activity {
  let mode: PlayMode | null = null;
  const listeners = new Set<(mode: PlayMode | null) => void>();
  return {
    get mode() {
      return mode;
    },
    set(next) {
      if (next === mode) return;
      mode = next;
      for (const cb of listeners) cb(mode);
    },
    isolated: () => mode === 'daily' || mode === 'race' || mode === 'online',
    on(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
