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
| `outcome(run)` | After each step: `'won'`, `'lost'` or null. The kit finishes the game **the frame it returns non-null** (see below) | `rules.ts` |

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
| `nav` | `active(ctx, state)`: when the kit's pad navigation is on (default: off in play when A or B are the game's); `hubRing` ([input.md](input.md#menus)) |
| `backGuard` | Edge swipes and Back pause play instead of leaving: default on (off with `resumeOnClose`); `false`, `true` or options ([ui.md](ui.md#the-back-guard)) |
| `stepDt` | Seconds per step (default 1/60) |
| `daily` | `meta(run, outcome)`, `offline` ([daily.md](daily.md)) |
| `race` | `stats(run)`, `progress(run)`, `params()` ([race.md](race.md)) |
| `online` | `onlineGame({...})` from `online.ts` ([online.md](online.md)) |
| `turns` | `draw(ctx, el, board)`, `create`, `testMove(board)`: the board of an online game the hub runs, from `turns/board.ts` ([turns.md](turns.md)) |
| `audio` | Sound and music ([audio.md](audio.md)) |
| `avatar` | Faces ([avatar.md](avatar.md)) |
| `snap(run)` | A JSON summary for tests and shots (`__game.snap()`), with a numeric `score` |
| `addScore(run, n)` | Raise the score by `n` (`__game.addScore`) |
| `autoplay(ctx, run)`, `solve(run)` | Test drivers (`__game.autoplay`, `__game.solveNow`) |
| `testHook(ctx)` | Extra drivers (`test-hook.ts`) |

`snap`, `addScore`, `solve` and `turns.testMove` are the **test contract**: the kit's
own suites need them (and nothing else of your game):
[testing.md](testing.md#what-the-kits-tests-need-from-your-game).

## Endings take time: keep `outcome` null until they're done

The session finishes the game (result screen, scores, the daily's completion)
the frame `outcome(run)` first returns non-null. A game with an ending
animation (the last row flips, a celebration, a slow-motion knockout) keeps
`outcome` null until it is over: count the animation in the rules, in the
saved game (`phase: 'ending'`, `phaseT`), so it pauses with the game and
replays the same from a saved game:

```ts
// rules.ts
export function step(run: Run, dt: number): void {
  if (run.phase === 'ending') run.phaseT += dt;
  // … when the last move lands: run.phase = 'ending'; run.phaseT = 0;
}
export const outcome = (run: Run) => (run.phase === 'ending' && run.phaseT >= ENDING_SECONDS ? run.result : null);
```

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
