/**
 * Extra `window.__game` drivers for this game's tests and screenshots. (GAME: yours to edit.)
 *
 * The kit already gives newGame, pause, resume, toTitle, solveNow, loseNow,
 * setState, autoplay and toast (docs/kit/test-hook.md). Add what reaches
 * your game's own scenes fast. Drivers exist only under `__HUB_TEST__`, on
 * localhost and in dev.
 */
import type { GameContext } from '../kit/boot/index.ts';
import type { GameHookDrivers } from '../kit/test-hook/index.ts';
import type { Profile, Run } from './state.ts';

/** TODO(game): your drivers. */
export function testHook(ctx: GameContext<Profile, Run>): GameHookDrivers['extra'] {
  return {
    /** Give the player some coins (`__game.extra.addCoins(5)`). */
    addCoins: (n) => {
      const run = ctx.session.run;
      if (run && typeof n === 'number') run.score += n;
    },
  };
}
