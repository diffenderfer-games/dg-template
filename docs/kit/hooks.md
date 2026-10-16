# The hooks

KIT doc. A game is a `GameDefinition` (`src/kit/boot/types.ts`), built in
`src/game/hooks.ts` and passed to `defineGame(hub, game)` in `src/main.ts`.
The kit calls these; you fill them in. `npm run todo` lists the open
`TODO(game)` stubs.

## Required

| Hook | When the kit calls it | Example file |
|---|---|---|
| `copy` | The title screen's words (`title`, `tagline`, `howTo`) | `strings.ts` |
| `profile` | Load/save the long-term profile: `version`, `defaults`, `merge(cloud, local)`, `validate` | `state.ts` |
| `run` | The game in progress: `version`, `validate`, `progress(run)` (the "Your games" label) | `state.ts`, `rules.ts` |
| `input` | The controls (`groups`, `virtual(width)`) | `controls.ts` |
| `mount(ctx)` | Once: build the renderer into `ctx.stage` | `render/` |
| `newRun(ctx, opts)` | A new game. Use only `opts.rng`; `opts.mode`, `opts.day`, `opts.params` | `rules.ts` |
| `step(ctx, run, dt)` | Every fixed step while playing (read `ctx.hub.input`) | `rules.ts` |
| `render(ctx, run, alpha)` | Every frame (`run` is null on menus) | `render/` |
| `outcome(run)` | After each step: `'won'`, `'lost'` or null | `rules.ts` |

## Optional

| Hook | What for |
|---|---|
| `scores` | Leaderboards (`boards`) |
| `result(run, outcome)` | The numbers for boards and stats (`boards`, `incr`, `max`) |
| `onResult(ctx, run, outcome)` | A normal game ended: update bests and unlocks (never for dailies or races) |
| `screens` | Decorate `title`, `hud` (`mount`, `update`), `pause`, `result` |
| `settingsRows(ctx)` | The game's own settings rows |
| `strings` | Override kit strings |
| `resumeOnClose` | Turn-based / idle games resume when hub UI closes (action games show pause) |
| `stepDt` | Seconds per step (default 1/60) |
| `daily` | `meta(run, outcome)`, `offline` ([daily.md](daily.md)) |
| `race` | `stats(run)`, `progress(run)`, `params()` ([race.md](race.md)) |
| `online` | `onlineGame({...})` from `online.ts` ([online.md](online.md)) |
| `turns` | `draw(ctx, el, board)`, `create`: the board of an online game over days, from `turns/board.ts` ([turns.md](turns.md)) |
| `audio` | Sound and music ([audio.md](audio.md)) |
| `avatar` | Faces ([avatar.md](avatar.md)) |
| `snap(run)` | A JSON summary for tests and shots (`__game.snap()`) |
| `autoplay(ctx, run)`, `solve(run)` | Test drivers (`__game.autoplay`, `__game.solveNow`) |
| `testHook(ctx)` | Extra drivers (`test-hook.ts`) |

## The context

Every hook gets `ctx` (`GameContext`): `hub`, `slug`, `clock`, `activity`,
`profile` (the profile store), `settings`, `resume`, `controls`, `audio`,
`stage` (`#app`), `uiRoot` (`#ui`), `session` (`run`, `mode`, `screen`,
`paused`, `newGame()`, `restart()`, `toTitle()`, `pause()`, `resume()`,
`finish(outcome)`), `size()`, `region()` (where gameplay may draw),
`onResize(cb)`, `toast(text)`, `haptic(strong?)`.

## What the kit does around them

Pause on hub UI and on the `pause` input; saves and Continue; the late-load
guard; dailies from the deep link and the hub menu; races; online launches;
boards and stats with the mode rules; presence; menus with keyboard and
gamepad navigation; music in a worker; `window.__game`. See
[boot.md](boot.md) for the order things happen in.
