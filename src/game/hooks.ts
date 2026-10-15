/**
 * The game, as the kit sees it: every hook in one place. (GAME: yours to edit.)
 *
 * `createGame(createView)` takes the renderer as an argument, so the unit
 * tests (tests/hub-events/) run these same hooks with a fake view; game.ts
 * passes the real one.
 *
 * `defineGame(hub, game)` (src/main.ts) does every hub duty around these
 * hooks: pause, saves, Continue, the daily, races, scores, menus, the test
 * hook. Fill in the files this imports; `npm run todo` lists what's left.
 * Every hook is described in docs/kit/hooks.md.
 */
import type { GameDefinition } from '../kit/boot/index.ts';
import type { JsonObject } from '../kit/core/index.ts';
import { BOARDS, PROFILE_VERSION, RUN_VERSION } from './config.ts';
import { controls } from './controls.ts';
import { daily } from './daily.ts'; // new-game:daily
import { race } from './race.ts'; // new-game:race
import { newRun, outcome, progress, solve, steerToCoin, step, type StepInput } from './rules.ts';
import { hud } from './screens/hud.ts';
import { result } from './screens/result.ts';
import { title } from './screens/title.ts';
import { defaultProfile, isProfile, isRun, mergeProfile, type Profile, type Run } from './state.ts';
import { COPY, KIT_OVERRIDES } from './strings.ts';
import { testHook } from './test-hook.ts';
import type { Region } from '../kit/layout/index.ts';
import type { View } from './view.ts';

/** Makes the renderer (src/game/render/). */
export type ViewFactory = (o: { region: () => Region; slug: string }) => View;

/** The game's definition, drawn by `createView`. */
export function createGame(createView: ViewFactory): GameDefinition<Profile, Run> {
  let view: View | null = null;
  /** Set by the autoplay test driver for one step. */
  let auto: StepInput | null = null;
  return {
    copy: COPY,
    strings: KIT_OVERRIDES,
    profile: { version: PROFILE_VERSION, defaults: defaultProfile, merge: mergeProfile, validate: isProfile },
    run: { version: RUN_VERSION, validate: isRun, progress },
    input: controls,
    scores: { boards: BOARDS },

    async mount(ctx) {
      view = createView({ region: () => ctx.region(), slug: ctx.slug });
      await view.mount(ctx.stage);
    },

    newRun: (_ctx, opts) =>
      newRun(opts.mode, opts.seed, { coins: typeof opts.params?.coins === 'number' ? opts.params.coins : undefined }),

    step(ctx, run, dt) {
      const got = step(run, dt, auto ?? ctx.hub.input.vector('move'));
      auto = null;
      if (got > 0) {
        view?.collected?.(run.coin);
        ctx.audio.play('coin');
        ctx.haptic();
      }
    },

    render: (_ctx, run, alpha) => view?.draw(run, alpha),
    outcome,
    result: (run) => ({ boards: { high: run.score }, incr: { played: 1 }, max: { bestCoins: run.score } }),

    onResult(ctx, run) {
      ctx.profile.update((p) => {
        p.best = Math.max(p.best, run.score);
        p.played++;
      });
    },

    snap: (run): JsonObject =>
      run === null
        ? { menu: true }
        : { score: run.score, target: run.target, t: Math.round(run.t), mode: run.mode, over: run.over },
    autoplay: (_ctx, run) => {
      auto = steerToCoin(run);
    },
    solve,
    testHook,

    screens: { title, hud, result },
    daily, // new-game:daily
    race, // new-game:race
  };
}
