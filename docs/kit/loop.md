# kit/loop

Source: `src/kit/loop/` (KIT: copy byte-identical; change it in the template first).

`kit/loop` is a fixed-step simulation with interpolated rendering. `simulate(dt)` always gets the same `dt`, so a seeded game plays the same on every device. That is what keeps dailies and races fair. A game does not create the loop: `defineGame` owns one inside the session and calls the game's `step` and `render` hooks. A game touches this module only to change the step size or, for a game with its own renderer ticker, to drive `frame` itself.

## What the game does

Write `step` and `render` hooks. Set `stepDt` only if 1/60 s is wrong for the game.

```ts
const game: GameDefinition<Profile, Run> = {
  stepDt: 1 / 30, // optional; default 1/60
  // dt is the fixed step in seconds. No Date.now(), no Math.random(), no frame time in here.
  step: (ctx, run, dt) => step(run, dt, ctx.hub.input.vector('move')),
  // alpha is 0..1: how far between two steps this frame falls. Interpolate with it.
  render: (_ctx, run, alpha) => view?.draw(run, alpha), // run is null on menus
  // ...
};
```

Outside `defineGame` (a tool or a test) the loop is used directly:

```ts
import { FixedLoop, clampDt } from '../kit/loop/index.ts';

const loop = new FixedLoop({ dt: 1 / 60, simulate: (dt) => sim(dt), render: (a) => draw(a), paused: () => paused });
loop.start();        // driven by the clock's frames (requestAnimationFrame)
loop.frame(nowMs);   // or drive it from a renderer's ticker
const dt = clampDt(frameMs); // a variable-dt game: seconds, clamped to 0.05
```

## What the kit does for you

- Accumulates elapsed time and runs as many fixed steps as fit, then renders once with `alpha`.
- Caps the time simulated per frame (`maxFrame`, 0.25 s), so a long stall (a hidden tab) does not spiral.
- While `paused()` it simulates nothing but keeps rendering, so a pause screen can animate.
- The session pauses the loop when the screen is not `play` or the game is paused, and runs `step` only while a run exists and is not finished.
- Online matches use the same loop: the session calls `OnlineFlow.frame(dt)` instead of the game's `step`.

## Rules it enforces

- The same seed gives the same game on every device, so races and dailies stay fair: [docs/multiplayer.md §14.3](../multiplayer.md#143-fairness-same-seed-same-puzzle).
- Real-time races need seeded, tick-based simulation, not frame-time based: [docs/multiplayer.md §14.3](../multiplayer.md#143-fairness-same-seed-same-puzzle).
- Pause while hub UI is open: [docs/multiplayer.md §4](../multiplayer.md#4-pausing-when-the-hub-opens-every-game).

## Options / API

| Export | What |
|---|---|
| `FixedLoop` | The loop class. |
| `FixedLoopOptions` | `dt` (default 1/60), `maxFrame` (0.25), `simulate`, `render`, `paused?`, `clock?`. |
| `loop.frame(nowMs)` | Run one frame at this time (for a renderer's ticker). |
| `loop.start()`, `loop.stop()` | Drive frames from the clock; stop and reset. |
| `loop.setDt(dt)` | Change the step (rarely: slow motion). |
| `loop.running`, `loop.steps` | Whether it runs; steps simulated so far. |
| `clampDt(ms, max?)` | A variable-dt frame time in seconds, clamped (default 0.05). |

## Tests

- `tests/kit/layout/layout-loop.test.ts`: N fixed steps for M ms with alpha in [0, 1), the `maxFrame` cap, no steps while paused but still rendering, start and stop from the clock, `clampDt`.
- `tests/game/sim.test.ts`: the game's seeded simulation.

## Hub API used:

- None. It uses the kit's `Clock` (`kit/core`), which tests replace with a fake.
