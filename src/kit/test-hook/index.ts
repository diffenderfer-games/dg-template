/**
 * kit/test-hook: `window.__game`, the one hook every script, suite and screenshot uses.
 * Source: dg-template src/kit/test-hook/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/test-hook.md
 *
 * Read-only fields are always there (the screenshot runner reads them in
 * production builds). Drivers (`newGame`, `setState`, `solveNow`…) are
 * installed only when `window.__HUB_TEST__` is set before load, on localhost,
 * or in dev (weston / GD gating). One name for every game: `__game`.
 */
import type { PlayMode } from '../core/activity.ts';
import type { Json, JsonObject } from '../core/json.ts';

/** What anyone may read. */
export type GameHookInfo = {
  readonly slug: string;
  /** The kit version. */
  readonly kit: string;
  /** The current screen (`title`, `play`, `pause`, `result`, `lobby`…). */
  screen(): string;
  paused(): boolean;
  mode(): PlayMode | null;
  /** A JSON summary of the game's state (the game supplies it). */
  snap(): JsonObject;
  /** The game has mounted (`body[data-ready="1"]`). */
  ready(): boolean;
  /** Sound telemetry: `{ unlocked, host, underruns, maxRenderMs }` (kit/audio). */
  audio?(): JsonObject;
};

/** Drivers: reach scenes fast in tests and screenshots. */
export type GameHookDrivers = {
  newGame(opts?: { mode?: PlayMode; seed?: number }): void;
  pause(): void;
  resume(): void;
  toTitle(): void;
  /** Win at once (dailies, puzzles). */
  solveNow(): void;
  /** Lose at once. */
  loseNow(): void;
  setState(state: Json): void;
  autoplay(on: boolean): void;
  /** Show a kit toast (the `toast` screenshot). */
  toast(text: string): void;
  /** Anything the game adds (src/game/test-hook.ts). */
  extra: Record<string, (...args: Json[]) => Json | void>;
};

/** The whole hook. */
export type GameTestHook = GameHookInfo & Partial<GameHookDrivers>;

declare global {
  interface Window {
    __game?: GameTestHook;
  }
}

/** Install `window.__game`; drivers only when `allowDrivers`. Returns the hook. */
export function installTestHook(
  info: GameHookInfo,
  drivers: () => Partial<GameHookDrivers>,
  opts: { allowDrivers: boolean; win?: Window },
): GameTestHook {
  const hook: GameTestHook = opts.allowDrivers ? Object.assign({}, info, drivers()) : { ...info };
  const win = opts.win ?? (typeof window === 'undefined' ? undefined : window);
  if (win) win.__game = hook;
  return hook;
}
