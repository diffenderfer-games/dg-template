/**
 * kit/pause: pause when hub UI opens, when the page hides, or when the player asks.
 * Source: dg-template src/kit/pause/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/pause.md
 *
 * Rules (multiplayer.md §4):
 * - `hub.overlay.autoPause` exactly once, at boot (installPause is called once);
 * - a hub close never undoes a pause the player made (skipbo `pausedByHub`);
 * - action games show their pause screen on close; turn-based/idle games may
 *   resume (`resumeOnClose`);
 * - never pause when `canPause()` is false: in a race (the pause button becomes
 *   "Leave race?") or a live online match (`setBusy` makes the hub skip it too);
 * - pause when the page is hidden (dinodasher, skipbo);
 * - the click that closed the hub menu doesn't reach the game (bubblepop `settleT`);
 * - the hub's on-screen keyboard (reason `keyboard`, typing in the game's own
 *   text field) doesn't pause: the pause screen would cover the field.
 */
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';

/** Why the game is paused. */
export type PauseReason = 'hub' | 'player' | 'hidden';

/** What the game does on pause. */
export type PauseSpec = {
  /** May the game pause now? False on menus, in a race, in a live online match. */
  canPause(): boolean;
  /** Show the pause screen (or just stop, for `hidden`). */
  show(why: PauseReason): void;
  /** Hide it: play goes on. */
  hide(): void;
  /** Turn-based and idle games resume when hub UI closes (if the hub caused the pause). */
  resumeOnClose: boolean;
};

/** The pause state. */
export type PauseHandle = {
  readonly paused: boolean;
  /** The reason of the current pause (null when playing). */
  readonly why: PauseReason | null;
  pause(why: PauseReason): boolean;
  resume(): void;
  /** True for a moment after hub UI closed: ignore that click. */
  justClosed(): boolean;
  dispose(): void;
};

/** How long after hub UI closes a click is swallowed. */
export const SETTLE_MS = 300;

/** Install the pause rules (once, at boot). */
export function installPause(
  hub: Pick<HubLike, 'overlay'>,
  spec: PauseSpec,
  deps: { clock: Clock; doc?: Document; win?: Window },
): PauseHandle {
  let why: PauseReason | null = null;
  let closedAt = -Infinity;
  const doc = deps.doc ?? (typeof document === 'undefined' ? undefined : document);
  const win = deps.win ?? (typeof window === 'undefined' ? undefined : window);

  const handle: PauseHandle = {
    get paused() {
      return why !== null;
    },
    get why() {
      return why;
    },
    pause(reason) {
      if (why !== null) {
        if (reason === 'player' && why !== 'player') why = 'player'; // the player owns it now
        return true;
      }
      if (!spec.canPause()) return false;
      why = reason;
      spec.show(reason);
      return true;
    },
    resume() {
      if (why === null) return;
      why = null;
      spec.hide();
    },
    justClosed: () => deps.clock.now() - closedAt < SETTLE_MS,
    dispose: () => undefined,
  };

  // Registered before autoPause, so it runs first and the pause callback knows the reason.
  let reason = '';
  const stopReason = hub.overlay.on('open', (e) => {
    reason = e.reason;
  });
  const stopAuto = hub.overlay.autoPause({
    pause: () => {
      if (reason !== 'keyboard') handle.pause('hub');
    },
    resume: () => {
      if (why === 'hub') handle.resume();
    },
    resumeOnClose: spec.resumeOnClose,
  });
  const stopClose = hub.overlay.on('close', () => {
    closedAt = deps.clock.now();
  });

  const swallow = (e: Event): void => {
    if (!handle.justClosed()) return;
    e.stopPropagation();
    e.preventDefault();
  };
  const onVisibility = (): void => {
    if (doc?.visibilityState === 'hidden') handle.pause('hidden');
  };
  win?.addEventListener('pointerdown', swallow, true);
  win?.addEventListener('click', swallow, true);
  doc?.addEventListener('visibilitychange', onVisibility);

  handle.dispose = () => {
    stopReason();
    stopAuto();
    stopClose();
    win?.removeEventListener('pointerdown', swallow, true);
    win?.removeEventListener('click', swallow, true);
    doc?.removeEventListener('visibilitychange', onVisibility);
  };
  return handle;
}

/**
 * The hub menu button: hidden while actively playing, shown on the pause
 * screen and every menu (bfme hubMenu.ts). Idempotent: call on every change.
 */
export function syncMenuButton(hub: Pick<HubLike, 'menu'>, state: { playing: boolean; paused: boolean }): void {
  const visible = !state.playing || state.paused;
  if (hub.menu.visible !== visible) hub.menu.setVisible(visible);
}
