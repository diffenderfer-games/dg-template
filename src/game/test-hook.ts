/**
 * Extra `window.__game` drivers for this game's tests and screenshots. (GAME: yours to edit.)
 *
 * The kit already gives newGame, pause, resume, toTitle, solveNow, loseNow,
 * addScore, setState, autoplay and toast (docs/kit/test-hook.md). Add what
 * reaches your game's own scenes fast; they show up as `__game.extra.<name>`.
 * Drivers exist only under `__HUB_TEST__`, on localhost and in dev.
 */
import type { GameContext } from '../kit/boot/index.ts';
import type { GameHookDrivers } from '../kit/test-hook/index.ts';
import type { Profile, Run } from './state.ts';

/** TODO(game): your drivers (e.g. `toLevel: (n) => …`). */
export function testHook(_ctx: GameContext<Profile, Run>): GameHookDrivers['extra'] {
  return {};
}
