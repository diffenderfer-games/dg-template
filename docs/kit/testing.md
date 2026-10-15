# kit/testing

Source: `src/kit/testing/` (KIT: copy byte-identical; change it in the template first).

Everything a test needs and no shipped code uses: `FakeHub` (a fake of the whole hub client that records every call), a fake clock, fake storage, the planned-phase list and a balance sim. Only tests and scripts import it, so the build tree-shakes it out. `defineGame` does not use it. A game touches it when it writes tests for its own rules or hub behaviour.

## What the game does

Test against `FakeHub`, never a stub of your own. It implements `HubLike`, so `defineGame` accepts it.

```ts
import { defineGame } from '../../src/kit/boot/index.ts';
import { createFakeHub, fakeStorage } from '../../src/kit/testing/index.ts';

const fake = createFakeHub({ user: { id: 7, username: 'Sam', guest: false }, events: new EventTarget() });
defineGame(fake, game, { clock: fake.clock });
fake.openOverlay('menu'); // the hub menu opens (returns its close function)
fake.clock.advance(50);
await fake.clock.settle(); // let promises run
expect(fake.log.names()).toContain('overlay.open');
fake.goOffline(); // hub:offline + status change
fake.auth(null); // hub:auth (log out)
```

## What the kit does for you

- `FakeHub` records every hub call in `fake.log` (a `CallLog`) and has drivers for hub events: `openOverlay`, `auth`, `reset`, `goOffline`, `goOnline`, `menuVisible`, `runtime`, `blocker`, `today`.
- Sub-fakes with their own drivers: `fake.daily.start(day)`, `fake.race.start/end/exit/close/hud`, `fake.rooms` and `FakeRoom` (`setInfo`, `addSeat`, `receive`, `seatChange`, `chatFrom`, `kicked`, `endedBy`), `fake.progress.seed(slot, data)` with `failReads` and `readDelay`, `fake.resume.loadDelay`, `fake.input`, `fake.mp`, `fake.social`.
- Planned APIs (`hub.saved`, `hub.turns`, `hub.avatar`, world) exist only when you build with `planned: { savedGames, turns, avatars, world }`, so the kit sees the same "absent" as the real client.
- `fakeClock()` moves only when told: `advance(ms)`, `flushFrames()`, `pending()`, `settle()`. It starts at 2026-10-15T00:00:00Z.
- `fakeStorage(initial?)` is a Map-backed `Storage` with `dump()`; `throwingStorage()` throws on every call like Safari private mode.
- Behaviour is copied from the hub docs and client source. Contract and parity tests keep it honest (below).

## Rules it enforces

- Every hub event and callback has a unit test (the hub-event list, Appendix B of [docs/plans/template-kit.md](../plans/template-kit.md)).
- Online games ship the required hub scenarios: [docs/multiplayer.md §12 Required scenarios](../multiplayer.md#required-scenarios) and [The hub test kit](../multiplayer.md#the-hub-test-kit).
- Race tests: [docs/multiplayer.md §14.5](../multiplayer.md#145-testing).
- Definition of done includes passing hub suites: [docs/multiplayer.md §13](../multiplayer.md#13-definition-of-done).
- Offline and no-hub behaviour: [docs/multiplayer.md Offline and no-hub behaviour](../multiplayer.md#offline-and-no-hub-behaviour).

## Options / API

| Export | What it is |
| --- | --- |
| `createFakeHub(options)`, `FakeHub` | The fake hub. Options: `slug`, `user` (null = signed out), `offline`, `resumeRequested`, `clock`, `events`, `planned` |
| `CallLog`, `FakeCall` | Ordered log: `record`, `named`, `count`, `names`, `last`, `clear`, `calls` |
| `fakeClock(start?)`, `FakeClock` | Hand-driven clock |
| `fakeStorage`, `throwingStorage` | Storage fakes |
| `FakeOverlay`, `FakeInput`, `FakeDaily`, `FakeProgress`, `FakeResume`, `FakeRace`, `FakeRooms`, `FakeRoom`, `FakeMp`, `FakeSocial`, `FakePresence`, `FakeNotify`, `FakeMenu` | The parts of the fake |
| `FakeSaved`, `FakeTurns`, `FakeTurnGame`, `FakeAvatar` | Planned-API fakes |
| `fakePlayer`, `fakeSeat`, `fakeRoomInfo`, `fakeHubError`, `fakeAudioContext` | Builders |
| `HUB_PHASES`, `HubPhase`, `shipped(...)`, `waitsOn(...)` | The planned-phase list |
| `simulate`, `seedRange`, `formatReport`, `SimSpec`, `SimReport` | The sim (`kit/testing/sim.ts`, imported by path, not from the index) |

## The test pyramid

1. Unit tests, vitest (`npm test`, which runs `--project kit --project hub-events --project game`):
   - `kit`: `tests/kit/**` and `tests/scripts/**`, one module at a time (Node; a file opts into jsdom with `// @vitest-environment jsdom`).
   - `hub-events`: `tests/hub-events/**`, the kit against the stub game on a `FakeHub` (jsdom).
   - `game`: `tests/game/**`, your rules, determinism and sims (jsdom).
   - `slow`: `**/*.slow.test.ts`, long sims and the 365-day daily harness (`npm run test:slow`).
2. Hub suites, a real hub in a real browser: `npm run test:hub` runs `node --test` on `tests/hub/**/*.test.ts`, one file at a time.
3. Screenshots (`npm run shots`, `npm run shots:hub`) look at the real thing; see the screenshots doc.

Put most checks at the bottom: they are fast and need no browser.

### Hub-event tests

`tests/hub-events/_support/harness.ts` boots the stub game on a fresh `FakeHub`:

```ts
import { describe, expect, it } from 'vitest';
import { bootGame } from './_support/harness.ts';

it('opening hub UI pauses the game once', async () => {
  const g = await bootGame(); // options: fake, search, patch, before, strings
  await g.start(); // new normal game
  g.fake.openOverlay('menu');
  await g.frames(1);
  expect(g.hook.paused()).toBe(true);
  expect(g.calls.count('screen.pause')).toBe(1); // the game's hook calls (newRun, onResult, screens)
});
```

`g.fake` is the `FakeHub`, `g.hook` is `window.__game`, `g.ui` is the kit's DOM, `g.press(testid)` clicks a kit button, `g.frames(n)` runs n 16 ms frames, `g.settle()` lets promises run. The suites test the kit contract through the stub game's real hooks, not pixels, so a game that replaces the stubs keeps them green.

### Planned hub tests

`src/kit/testing/phases.ts` lists hub phases that are not published yet: `savedGames01`, `savedGames3`, `savedGames4`, `avatars0`, `avatars2`, `avatars4`, `worldW2`, `worldW3`, `worldW4`. Each has `shipped: false`. `waitsOn(...phases)` gives a skip reason; `shipped(...phases)` is true when all are out. Write the test now and skip it:

```ts
import { planned } from './_support/planned.ts';
planned('savedGames01')('row 56: hub.saved opens a daily in progress', async () => { /* ... */ });
```

For node tests: `{ skip: shipped('worldW2') ? false : waitsOn('worldW2') }`. When the hub publishes a phase, a kit minor version flips its entry to `true` and the tests run. `HUB_PHASES` is a constant, not an environment variable: nothing reads an env of that name.

### Sim

`kit/testing/sim.ts` plays the pure rules many times with a policy and summarizes. `simulate(spec, seedRange(100))` returns `{ games, outcomes, stats }` with min, max, mean and median per measure. `src/game/sim.ts` has this game's `simSpec(mode, skill)`; `npm run sim` prints a report (`npm run sim -- normal 2000 0.5` is mode, games, skill). `tests/game/sim.test.ts` asserts the tuning, for example that a decent player wins the daily, and that a normal game always ends:

```ts
const r = simulate(simSpec('daily', 0.8), seedRange(100));
expect(r.outcomes.won).toBeGreaterThanOrEqual(90);
```

### Browser hub suites

`tests/hub/_kit.ts` is the shared header. It loads the hub's own e2e kit from the hub checkout: `DG_HOST` if set, else `../diffenderfer-games` (`test/e2e/helpers.mjs`). One real test host starts per file with this game linked in. Each player is a browser context; console errors fail the test; screenshots are taken on failure. `DG_TEST_URL` points it at a running `npm run local` instead. Main exports: `env()`, `e2e(name, env, fn, opts)`, `game` (hook wrappers: `screen`, `mode`, `paused`, `snap`, `newGame`, `solveNow`, `autoplay`, `toTitle`, `pause`), `ready`, `waitScreen`, `openMenu`, `overlayLog`, `befriend`, `until`, `settle`, `today`, `L`, `SLUG`, `HUB`.

```ts
import { e2e, env, game, ready, SLUG, waitScreen } from '../_kit.ts';
const e = env();
e2e('a new game starts', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/`);
  await ready(a);
  await game.newGame(a);
  await waitScreen(a, 'play');
});
```

The kit's suites are `tests/hub/kit/`: `pause`, `progress` (saves, Continue, daily), `race`, `online`, `planned` (all skipped), and `fake-parity` (FakeHub gives the same logs as the real hub).

## Tests

- `tests/kit/testing/contract.test.ts`: the real `Hub` still fits `HubLike`.
- `tests/kit/testing/fake-hub.test.ts`: FakeHub fidelity.
- `tests/kit/testing/sim.test.ts`: the sim harness.
- `tests/hub/kit/fake-parity.test.ts`: fake against real, in a browser.

## Hub API used:

- Types only, from `@diffenderfer-games/hub` (`HubStatus`, `ResumeBlocker`, overlay and room types). The hub suites use the hub checkout's `test/e2e/helpers.mjs` and `test/helpers/client.mjs`.
