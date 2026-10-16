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
 * Every hook is described in docs/kit/hooks.md; what the kit's own tests need
 * from them is in docs/kit/testing.md § "What the kit's tests need from your game".
 */
import type { GameDefinition } from '../kit/boot/index.ts';
import type { InputLike } from '../kit/core/index.ts';
import type { JsonObject } from '../kit/core/index.ts';
import { BOARDS, PROFILE_VERSION, RUN_VERSION } from './config.ts';
import { audio } from './audio.ts';
import { avatar } from './avatar.ts'; // new-game:avatar
import { controls } from './controls.ts';
import { daily } from './daily.ts'; // new-game:daily
import { race } from './race.ts'; // new-game:race
import { createOnline } from './online.ts'; // new-game:online
import { turns } from './turns/board.ts'; // new-game:turns
import { addScore, autoInput, newRun, outcome, progress, solve, step, type StepInput } from './rules.ts';
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
  let input: InputLike | null = null;
  /** Set by the autoplay test driver for one step. */
  let auto: StepInput | null = null;
  /** Was the action button held last step? */
  let held = false;
  /** A press, counted once on the step it goes down: an edge per step (not per frame), so it is never counted twice. */
  const pressed = (): boolean => {
    const down = (input?.value('action') ?? 0) >= 0.5;
    const edge = down && !held;
    held = down;
    return edge;
  };
  return {
    copy: COPY,
    strings: KIT_OVERRIDES,
    profile: { version: PROFILE_VERSION, defaults: defaultProfile, merge: mergeProfile, validate: isProfile },
    run: { version: RUN_VERSION, validate: isRun, progress },
    input: controls,
    scores: { boards: BOARDS },

    async mount(ctx) {
      input = ctx.hub.input;
      view = createView({ region: () => ctx.region(), slug: ctx.slug });
      await view.mount(ctx.stage);
    },

    newRun: (_ctx, opts) =>
      newRun(opts.mode, opts.seed, {
        target: typeof opts.params?.target === 'number' ? opts.params.target : undefined,
      }),

    step(ctx, run, dt) {
      const got = step(run, dt, auto ?? { press: pressed() });
      auto = null;
      if (got > 0) {
        view?.scored?.(run);
        ctx.audio.play('score');
        ctx.haptic();
      }
    },

    render: (_ctx, run, alpha) => view?.draw(run, alpha),
    outcome,
    result: (run) => ({ boards: { high: run.score }, incr: { played: 1 }, max: { bestScore: run.score } }),

    onResult(ctx, run) {
      ctx.profile.update((p) => {
        p.best = Math.max(p.best, run.score);
        p.played++;
      });
    },

    // The test contract (docs/kit/testing.md): `snap().score` is the score and `addScore` raises it.
    snap: (run): JsonObject =>
      run === null
        ? { menu: true }
        : {
            score: run.score,
            target: run.target,
            t: Math.round(run.t),
            mode: run.mode,
            over: run.over,
            seed: run.seed,
          },
    addScore,
    autoplay: (_ctx, run) => {
      auto = autoInput(run);
    },
    solve,
    testHook,

    screens: { title, hud, result },
    daily, // new-game:daily
    race, // new-game:race
    audio,
    avatar, // new-game:avatar
    // new-game:online:start
    online: createOnline({
      input: () => ({ press: (input?.value('action') ?? 0) >= 0.5 }),
      render: (v, me) => view?.drawOnline?.(v, me),
    }),
    // new-game:online:end
    turns, // new-game:turns
  };
}
