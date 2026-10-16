# kit/test-hook

Source: `src/kit/test-hook/` (KIT: copy byte-identical; change it in the template first).

`window.__game`: the one hook that every script, test suite and screenshot uses to read and drive a game. It has the same name in every game. Read-only fields are always there (the screenshot runner reads them in production builds). Drivers such as `newGame`, `setState` and `solveNow` are installed only when `window.__HUB_TEST__` is set before load, on localhost, or in dev. `defineGame` installs it (through `kit/boot/test-hook.ts`) and sets `body[data-ready="1"]` when the game has mounted. The game adds `snap`, `solve`, `autoplay` and its own extra drivers.

## What the game does

```ts
import type { GameContext } from '../kit/boot/index.ts';
import type { GameHookDrivers } from '../kit/test-hook/index.ts';

// src/game/test-hook.ts: extra drivers, reachable as __game.extra.addCoins(5)
export function testHook(ctx: GameContext<Profile, Run>): GameHookDrivers['extra'] {
  return {
    addCoins: (n) => {
      const run = ctx.session.run;
      if (run && typeof n === 'number') run.score += n;
    },
  };
}

// in the game definition
{ snap: (run) => (run === null ? { menu: true } : { score: run.score }), solve: (run) => { /* win now */ }, testHook }
```

From a browser test: `await page.evaluate(() => window.__game?.solveNow?.())`. The suites in `tests/hub/` wrap these calls in `game.newGame(p)`, `game.screen(p)` and so on (see [testing](testing.md#browser-hub-suites)).

## What the kit does for you

- Installs `window.__game` with the same fields in every game, typed for tests (`GameTestHook`).
- Gates the drivers: `installTestHook(info, drivers, { allowDrivers })`. `defineGame` passes `driversAllowed()` (dev, localhost or the test harness) unless the caller overrides it.
- Fills the read-only side from the session: `screen()`, `paused()`, `mode()`, `snap()`, `ready()`, plus `slug`, `kit` (the kit version) and `audio()` telemetry.
- Fills the drivers from the session: `newGame`, `pause`, `resume`, `toTitle`, `solveNow` (calls your `solve`), `loseNow`, `setState` (replaces the run if it passes `run.validate`), `autoplay`, `toast`.
- Adds the `online` drivers (`host`, `join`, `start`, `room`, `seats`, `view`) when the game has online play.

## Rules it enforces

- Hub test scenarios need a way to drive the game: [docs/multiplayer.md §12 Required scenarios](../multiplayer.md#required-scenarios) and [The hub test kit](../multiplayer.md#the-hub-test-kit).
- Race tests use the same hook: [docs/multiplayer.md §14.5](../multiplayer.md#145-testing).
- Drivers must not ship to players: they exist only in dev, on localhost and under `__HUB_TEST__` (`driversAllowed` in [core](core.md)).

## Options / API

| Name | What it is |
| --- | --- |
| `installTestHook(info, drivers, { allowDrivers, win? })` | Installs `window.__game`; returns the hook |
| `GameHookInfo` | `slug`, `kit`, `screen()`, `paused()`, `mode()`, `snap()`, `ready()`, optional `audio()` |
| `GameHookDrivers` | `newGame`, `pause`, `resume`, `toTitle`, `solveNow`, `loseNow`, `setState`, `autoplay`, `toast`, `online`, `extra` |
| `GameTestHook` | `GameHookInfo` plus `Partial<GameHookDrivers>` |
| `installGameHook(...)` (`kit/boot/test-hook.ts`) | What `defineGame` uses to build the two halves from the session |
| `KIT_VERSION` (`kit/boot`) | The kit version the hook reports (`'1.0'`) |

Screens reported by `screen()` include `title`, `play`, `pause`, `result`, `lobby` and `turns` (an online game the hub runs; its root carries `data-phase`, `data-kind` and `data-seq`).

## Tests

- `tests/kit/test-hook/test-hook.test.ts`
- `tests/hub-events/*` call `g.hook.*` on the stub game.
- `tests/hub/_kit.ts` and `tests/hub/kit/*.test.ts` drive it in a real browser.

## Hub API used:

- None directly. The hook reads the session; the test harness sets `window.__HUB_TEST__` before load.
