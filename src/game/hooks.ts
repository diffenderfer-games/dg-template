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
import type { JsonObject } from '../kit/core/index.ts';
import { BOARDS, PROFILE_VERSION, RUN_VERSION } from './config.ts';
import { audio } from './audio.ts';
import { avatar } from './avatar.ts'; // new-game:avatar
import { controls } from './controls.ts';
import { daily } from './daily.ts'; // new-game:daily
import { race } from './race.ts'; // new-game:race
import { createOnline } from './online.ts'; // new-game:online
import { turns } from './turns/board.ts'; // new-game:turns
import { addScore, newRun, outcome, progress, solve, step } from './rules.ts';
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
  return {
    copy: COPY,
    strings: KIT_OVERRIDES,
    profile: { version: PROFILE_VERSION, defaults: defaultProfile, merge: mergeProfile, validate: isProfile },
    run: { version: RUN_VERSION, validate: isRun, progress },
    input: controls,
    scores: { boards: BOARDS },
    // TODO(game): `resumeOnClose: true` for a turn-based or idle game (it resumes when hub UI closes).

    async mount(ctx) {
      view = createView({ region: () => ctx.region(), slug: ctx.slug });
      await view.mount(ctx.stage);
    },

    newRun: (_ctx, opts) => newRun(opts.mode, opts.seed, opts.params),

    step(_ctx, run, dt) {
      // TODO(game): read your inputs here (`ctx.hub.input.vector('move')`, `value('jump') >= 0.5`)
      // and pass them to the rules; play sounds (`ctx.audio.play('…')`) and haptics (`ctx.haptic()`).
      step(run, dt, {});
    },

    render: (_ctx, run, alpha) => view?.draw(run, alpha),
    outcome,
    // TODO(game): your boards and stats.
    result: (run) => ({ boards: { high: run.score }, incr: { played: 1 } }),

    onResult(ctx, run) {
      // TODO(game): your bests and unlocks (never touched by dailies or races).
      ctx.profile.update((p) => {
        p.best = Math.max(p.best, run.score);
        p.played++;
      });
    },

    // The test contract (docs/kit/testing.md): `snap().score`, `addScore` and `solve`.
    // TODO(game): add what your tests and screenshots want to read (the level, lives…).
    snap: (run): JsonObject =>
      run === null ? { menu: true } : { score: run.score, t: Math.round(run.t), mode: run.mode, over: run.over },
    addScore,
    solve,
    // TODO(game): `autoplay: (ctx, run) => …` (one step toward winning) for `__game.autoplay`.
    testHook,

    screens: { title, hud, result },
    daily, // new-game:daily
    race, // new-game:race
    audio,
    avatar, // new-game:avatar
    online: createOnline({ render: (v, me) => view?.drawOnline?.(v, me) }), // new-game:online
    turns, // new-game:turns
  };
}
