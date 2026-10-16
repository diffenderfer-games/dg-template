# kit/boot

Source: `src/kit/boot/` (KIT: copy byte-identical; change it in the template first).

`kit/boot` is the one entry point. A game hands `defineGame(hub, game)` a `GameDefinition` (its hooks) and the kit does every hub duty around them: pause, saves and Continue, the daily, races, online rooms, scores, the title/play/pause/result screens, menu navigation, sound, buzz and the `window.__game` test hook. The game touches it in two places: `src/main.ts` (one call, usually never edited) and `src/game/hooks.ts` (the hooks). Every hook is listed in [hooks.md](hooks.md).

## What the game does

Implement the hooks of `GameDefinition<P, R>` (`P` is the profile, `R` is the game in progress; both are JSON). Required: `copy`, `profile`, `run`, `input`, `mount`, `newRun`, `step`, `render`, `outcome`. Everything else is optional.

```ts
import { hub } from '@diffenderfer-games/hub';
import { defineGame, type GameDefinition } from './kit/boot/index.ts';

const game: GameDefinition<Profile, Run> = {
  copy: COPY, // { title, tagline?, howTo? }
  profile: { version: PROFILE_VERSION, defaults: defaultProfile, merge: mergeProfile, validate: isProfile },
  run: { version: RUN_VERSION, validate: isRun, progress },
  input: controls,
  scores: { boards: BOARDS },
  async mount(ctx) { await view.mount(ctx.stage); },
  newRun: (_ctx, opts) => newRun(opts.mode, opts.seed), // randomness only from opts.rng
  step: (ctx, run, dt) => step(run, dt, ctx.hub.input.vector('move')),
  render: (_ctx, run, alpha) => view.draw(run, alpha),
  outcome, // (run) => 'won' | 'lost' | null
};
defineGame(hub, game); // call once, synchronously, at load; no top-level await before it
```

Optional hooks: `result` (numbers for boards and stats), `onResult` (normal games only), `snap`, `autoplay`, `solve`, `testHook`, `settingsRows`, `screens` (`title`, `hud`, `pause`, `result`), `daily`, `race`, `online`, `avatar`, `audio`, `strings`, `resumeOnClose`, `stepDt`, `slug`.

## The context

Every hook gets a `GameContext` (built once in `context.ts`):

- `hub`, `slug`, `clock`, `activity`, `profile`, `settings`, `resume`, `controls`, `audio`.
- `session`: `run`, `mode`, `screen`, `paused`, plus `newGame()`, `restart()`, `toTitle()`, `pause()`, `resume()`, `finish(outcome)`.
- `stage` (`#app`, the renderer's element) and `uiRoot` (`#ui`, the kit's DOM layer).
- `size()`, `region()` (where gameplay may draw, see [layout.md](layout.md)), `onResize(cb)`.
- `toast(text)` and `haptic(strong?)`.

## Lifecycle

`defineGame` runs these steps in order. Steps 1 to 9 are synchronous, before any `await`, because the hub wants launch and daily handlers registered at once.

1. Set the strings, mount the UI root, create the activity and the screen manager.
2. Create the settings store, the profile (`kit/save`) and the resume slot (`kit/resume`), and the "Your games" handle (`kit/saved`).
3. Build the `Session`.
4. `installPause`: hub UI opening, the page hiding and the player's pause button.
5. Online (only if `game.online`): `OnlineFlow` plus `installLaunches` (`onLaunch` and `onJoinInfo`).
6. Race (only if `game.race`): `installRace` defines `hub.race` now; the hub calls `start` at the countdown.
7. Daily (only if `game.daily`): `installDaily` reads `?daily=` and the hub's daily events.
8. Controls (`defineControls`), menu navigation (`installMenuNav`), page listeners (`visibilitychange`, `pagehide`, `hub:reset`, `hub:menu-visibility`, `hub:offline`, `hub:online`, `hub:offline-failed`, `hub:rt-failed`, `hub:rt-ready`) and the control hints (`html[data-controls]`).
9. Sound (`createKitAudio`) and the buzz (`makeBuzz`), then `buildContext` and `session.attach`.
10. Async boot: show the loading screen, `await game.mount(ctx)`, start the loop, `routeOnce`, install `window.__game`, set `body[data-ready="1"]`.

`defineGame` returns `{ session, booted, dispose }`. Tests use `booted` and `dispose()`; the game ignores them. `DefineGameOptions` lets tests pass a fake `clock`, `store`, `events`, `stage`, `uiRoot`, `search` and `drivers`.

## Routing

`routeOnce` picks the first screen, in this order. The profile gets 2.5 s to load first (8 s when `?hub_resume=1`).

1. A race that already started, or a queued launch (invite, join, watch, rejoin) wins. A seat held after a reload is reclaimed (6 s). `?mp=lobby` waits 3 s for its launch, then hosts a room.
2. A game opened from "Your games" (`hub.saved`).
3. A daily that is queued plays now. A `?daily=` still being answered keeps the loading screen (its 8 s fallback shows the title).
4. `?hub_resume=1` with a saved game goes straight back in, no prompt.
5. Otherwise the title. Its Continue rows appear once the lookup answers.

## Session and modes

`PlayMode` is `normal`, `daily`, `race` or `online`. The session owns the game in progress, so the guards hold everywhere:

- A daily, race or online game sets the activity: no profile, board or Continue writes from it.
- A normal game autosaves to Continue every 5 s (`AUTOSAVE_MS`), on pause, on hide and on the title. It is cleared when it ends. A new game never replaces a saved one it has not seen (the late-load guard offers it in a toast).
- Every way out of a daily other than a win calls `daily.leave()`. Leaving a race or a room leaves it with the hub.
- A race is never paused. The pause button asks "Leave race?". Input waits for the go (`race.locked()`), status is reported each step, `finish` or `lose` is sent once.
- `finish(outcome)` records boards and stats by mode (`recordResult`), calls `onResult` for normal games, completes a won daily (score defaults to the first board), then shows the result screen. "Play again" shows for normal and daily only.
- Online mode skips `step` and `render` of the game; `OnlineFlow` runs the match (see [online.md](online.md)).

## Screens

`screens.ts` builds the title, loading, play (HUD row plus pause button), pause and result screens from `kit/ui`. The title shows Continue rows, Play, Daily, Race and Open races, Play online, Quick match, Play online, Settings and How to play, each only when the game supports it and with a `data-testid`. The game skins them with CSS variables ([ui.md](ui.md)) and decorates them through `screens` hooks. The title shows an offline note when `hub.isOffline`, and disables Play online and Play online after `hub:rt-failed`. An online game the hub runs has its own `turns` screen (`turns-flow.ts`, [turns.md](turns.md#the-screen)).

## What the kit does for you

- Registers every hub handler before the first `await`.
- Saves, resumes and clears the game in progress; reacts to `hub:reset`.
- Routes launches, deep links, dailies, races, online rooms and online games the hub runs (Your games, `?hub_turn_link=`) to the right mode.
- Syncs input groups and the hub menu button with the screen.
- Installs `window.__game` (see [test-hook.md](test-hook.md)); drivers only in dev, on localhost or under `__HUB_TEST__`.

## Rules it enforces

- Handlers registered at boot, within the hub's 8 s: [docs/multiplayer.md §6](../multiplayer.md#6-the-launch-contract).
- Pause on hub UI; online matches and races never pause: [docs/multiplayer.md §4](../multiplayer.md#4-pausing-when-the-hub-opens-every-game).
- Resume straight in with `?hub_resume=1`: [docs/hub.md Saved runs](../hub.md#saved-runs-hubresume).
- Same seed, same game for races and dailies: [docs/multiplayer.md §14.3](../multiplayer.md#143-fairness-same-seed-same-puzzle).
- Daily wiring: [docs/hub.md Daily challenges](../hub.md#daily-challenges).

## Options / API

| Export | What |
|---|---|
| `defineGame(hub, game, options?)` | Wire the game; returns `{ session, booted, dispose }`. |
| `GameDefinition`, `GameContext`, `SessionApi` | The hooks, the context, the session as hooks see it. |
| `NewRunOpts`, `ResultNumbers`, `Outcome`, `TitleInfo`, `ResultInfo` | Hook argument and result types. |
| `HudHooks`, `ScreenHooks`, `DailyHooks`, `RaceHooks` | Optional decorations and mode hooks. |
| `Session`, `AUTOSAVE_MS` | The play session and its autosave period. |
| `routeOnce` | The first-screen router (called by `defineGame`). |
| `titleScreen`, `loadingScreen`, `playScreen`, `pauseScreen`, `resultScreen`, `howToModal` | The standard screens. |
| `buildContext` | Builds the context (tests). |
| `installGameHook`, `KIT_VERSION` | The test hook for a `defineGame` game. |
| `OnlineFlow` | Online play in the session (`online-flow.ts`, imported by path). |

## Tests

There is no `tests/kit/boot/`. Boot is covered through the stub game:

- `tests/hub-events/*.test.ts` (FakeHub, one file per hub event group: `daily`, `input`, `online`, `overlay`, `planned`, `progress`, `race`, `resume`).
- `tests/hub/kit/*.test.ts` (real hub, browser): `pause`, `progress`, `race`, `online`, `saved`, `avatar`, `planned` (skipped), `fake-parity`.
- `tests/game/*.test.ts` for the stub game's own rules.

## Hub API used:

- `hub.presence.set` (per screen), `hub.input.*` (via `kit/input`), `hub.daily.startAndPlay`, `hub.daily.resume`.
- `hub.race.*` (via `kit/race`), `hub.mp.*` and `hub.rooms.*` (via `kit/online`), `hub.social.openInvite`, `openNotify`, `openPlayer`.
- `hub.isOffline`, `hub.slug`, and the window events listed under Lifecycle step 8.
