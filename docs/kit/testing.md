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
- `hub.saved`, `hub.turns`, `hub.avatar` and `hub.userId()` are always there, like the pinned client. The world's planned APIs (W2 tables, W3 `setRoster`) exist only when you build with `planned: { world: true }`, so the kit sees the same "absent" as the real client.
- `fake.daily.inProgressDay(day, saved?)` puts a day in progress (returns its id); `fake.saved.add(row)` adds a Your games row no other fake holds; `fake.avatar.change(userId, name)` changes someone's avatar; `fake.turns.open(id)` gives a `FakeTurnGame` with `opponentMoved`, `turnChanged`, `ended`, `seatConnected(seat, connected)` (a player comes or goes) and `chatFrom(line)`; its `canLetComputerPlay(now)` is the client's own rule, `letComputerPlay()` turns the due seats into `bot`, `rematch()` gives the next game, and `fake.turns.link` is the invite link the page was opened with.
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
| `FakeSaved`, `FakeTurns`, `FakeTurnGame`, `FakeAvatar` | Your games, online games the hub runs, avatars (`savedEntry`, `turnSummary`, `fakeAvatarRef` build their shapes) |
| `fakePlayer`, `fakeSeat`, `fakeRoomInfo`, `fakeHubError`, `fakeAudioContext` | Builders |
| `HUB_PHASES`, `HubPhase`, `shipped(...)`, `waitsOn(...)` | The hub-phase list |
| `simulate`, `seedRange`, `formatReport`, `SimSpec`, `SimReport` | The sim (`kit/testing/sim.ts`, imported by path, not from the index) |

## What the kit's tests need from your game

The kit's suites (`tests/hub-events/`, `tests/hub/kit/`) run against **your** hooks. They
ask the game for its shapes (a saved game is made by starting one, adding to its score and
pausing; a profile by finishing games; the race param comes from `game.race.params[0]`)
and need only this list, the **test contract**:

| The game gives | Used for |
| --- | --- |
| `snap(run)` with a numeric `score` | Every suite reads the score through `__game.snap()` |
| `addScore(run, n)` in the definition: `snap().score` grows by `n` (`__game.addScore(n)`) | Saved games, Continue, the daily, races, saves |
| `solve(run)`: the game is won now (`__game.solveNow()`) | Dailies and races that finish |
| `[data-testid="title-best"]` and `[data-testid="result-best"]` with the best score as a number in them (`Best 7`, `7 ★`) | Saves reach the title and another device |
| A profile whose `best` follows the score of a normal game (`onResult`), and `profile.merge` / `validate` that accept what the game pushes | Account switches, conflicts |
| `result(run).boards` naming boards in `scores.boards` (or none) | Boards get the numbers the game named |
| `turns.testMove(board)`: a legal move for this player, or null (`__game.turnsMove()`), when the game declares `game.turns` | The hub suite plays an online game the hub runs (it moves until the turn passes, so a player may move several times in a row; the creator's seat moves first) |
| `run.validate` that accepts the game's own saved games | Continue, days in progress |

Words never matter: the suites match numbers (`/\b7\b/`) and test ids, not `'Best 7'`.
The online and turns hub-event suites use kit-owned toys (`tests/hub-events/_support/toys.ts`)
in place of your `online` / `turns` hooks, so they test the kit's rooms and turns screen,
not your rules: your rules are tested in `tests/game/`.

## Kit tests that don't apply

Suites for features the game doesn't declare are **skipped on their own**, with the reason
in the test's name: no `game.multiplayer` (online rooms, the lobby), no `game.turns`,
no `game.race`, no `game.dailyChallenges`, no `game.resumable`, no `game.world`, no
`src/game/avatar.ts`, and no `titleDemo: true` in it (the title's bust, off by default). The kit's screenshot scenarios for them skip too.

A kit test that still doesn't fit the game (it assumes something your game does
differently on purpose) is **listed, never deleted**, in `tests/kit-skips.json` (a
GAME file) with the reason:

```json
{
  "skip": {
    "tests/hub/kit/world.test.ts": "no room in the world yet",
    "tests/hub-events/overlay.test.ts > row 2: an action game stays paused when hub UI closes; a turn-based one resumes only if the hub paused it": "a word game: hub UI never pauses it"
  }
}
```

- A key is a kit test file (every test in it) or `<file> > <test name>` (the test's own
  title, or its full name `describe > … > it`).
- vitest leaves listed files out and skips listed tests with the reason
  (`scripts/kit/vitest-skips.ts`); `npm run test:hub` and `e2e()` do the same. The
  files stay, so `kit:sync` and `kit:check` are untouched; `kit:check` fails on an
  entry that isn't a kit test or has no reason, and counts the skips.
- Say so in `docs/game.md` "Known issues" too.
- Never skip (or weaken) a kit test of a feature the game has just to get green: fix the
  game, or change the test in the template so it asks the game (the test contract above).
- Your own tests (`tests/game/`) are yours: change them freely.

## The test pyramid

1. Unit tests, vitest (`npm test`, which runs `--project kit --project hub-events --project game`):
   - `kit`: `tests/kit/**` and `tests/scripts/**`, one module at a time (Node; a file opts into jsdom with `// @vitest-environment jsdom`).
   - `hub-events`: `tests/hub-events/**`, the kit against the game's own hooks on a `FakeHub` (jsdom).
   - `game`: `tests/game/**`, your rules, determinism and sims (jsdom).
   - `slow`: `**/*.slow.test.ts`, long sims and the 365-day daily harness (`npm run test:slow`).
2. Hub suites, a real hub in a real browser: `npm run test:hub` (`scripts/kit/test-hub.ts`) runs `node --test` on `tests/hub/**/*.test.ts`, one file at a time. All of them take **20–25 minutes** (one test host per file); run one file with `npm run test:hub -- tests/hub/kit/progress.test.ts`. The test host **rebuilds the game from source** for each file: don't edit the game while it runs (work in another clone).
3. Screenshots (`npm run shots`, `npm run shots:hub`) look at the real thing; see the screenshots doc.

Put most checks at the bottom: they are fast and need no browser.

### Hub-event tests

`tests/hub-events/_support/harness.ts` boots the game (its own hooks, a recording view) on a fresh `FakeHub`:

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

`g.fake` is the `FakeHub`, `g.hook` is `window.__game`, `g.ui` is the kit's DOM, `g.press(testid)` clicks a kit button, `g.frames(n)` runs n 16 ms frames, `g.settle()` lets promises run; `g.calls` records the game's hooks (`newRun`, `step`, `result`, `onResult`, screens). The harness also asks the game: `HAS` (the features it declares; `describeIf(HAS.race, why)` skips a suite without them), `RACE_PARAM`, `savedGame(score)`, `savedDay(day, score)`, `profileAfter(...scores)`, `playTo(g, score)`, `resultBoards(g)`. The suites test the kit through the game's real hooks, not pixels, and need only the test contract (above).

### Planned hub tests

`src/kit/testing/phases.ts` lists the hub phases kit features wait on: `savedGames01`, `savedGames3`, `savedGames4`, `avatars0`, `avatars2`, `avatars4` (`shipped: true`: hub client next.6), `world0` and `worldW4` (`shipped: true`: the live world and a game's own room, next.9), `adventure` (`shipped: true`: Adventure Mode, next.10), and `worldW2`, `worldW3` (`shipped: false`: game tables in the world and in-game presence, coming). `waitsOn(...phases)` gives a skip reason; `shipped(...phases)` is true when all are out. Write the test now and skip it:

```ts
import { planned } from './_support/planned.ts';
planned('savedGames01')('row 56: hub.saved opens a daily in progress', async () => { /* ... */ });
```

For node tests: `{ skip: shipped('worldW2') ? false : waitsOn('worldW2') }`. When the hub publishes a phase, a kit minor version flips its entry to `true` and the tests run. `HUB_PHASES` is a constant, not an environment variable: nothing reads an env of that name.

### Online games the hub runs: checkTurnRules

The rules module's conformance test is the hub's own kit (`checkTurnRules`,
re-exported by kit/turns; multiplayer.md [§16.7](../multiplayer.md#167-testing)).
`tests/game/turns.test.ts` runs it on the game's rules:

```ts
checkTurnRules(rules, {
  seats: [2, 4],
  games: 50,
  plant: (state, seat, marker) => plantInHand(state, seat, marker),
  revealed: (state, marker) => state.discard.includes(marker),
  shuffleHidden: (state, seat, rng) => redealOthers(state, seat, rng),
});
```

| Option | What it checks |
| --- | --- |
| `seats`, `games`, `maxMoves` | Seat counts to play (default `[2]`), games per count (25), the longest game allowed (2000 moves) |
| `setupOptions`, `mode` | What games are set up with |
| `randomMove(state, seat, rng)` | A legal move (default: the rules' `autoMove`; one of the two is needed) |
| `reactMove(state, seat, rng)` | A legal move out of turn for a `mayAct` seat, or `null` (default: `autoReact`) |
| `plant(state, seat, marker)` | Hide `marker` where only `seat` may see it; no other seat's `view` or `eventView` may contain it |
| `revealed(state, marker)` | True once a planted marker is rightly public (played face up, shown at the end): from then on that marker isn't checked, so a played card isn't a leak |
| `shuffleHidden(state, seat, rng)` | The twin table: a copy with everything `seat` may not see shuffled or redealt (the deck's order, the other hands, keeping their counts); after every move each seat's `view` of the twin must equal its view of the real state, which catches leaks a marker can't (an order, a count, a hint) |
| `fixtures` | Old states that must still load through `migrate` |

It throws `checkTurnRules: …` with the seed; the report is `{ games, moves, longestGame, outOfTurn }`.

### Sim

`kit/testing/sim.ts` plays the pure rules many times with a policy and summarizes. `simulate(spec, seedRange(100))` returns `{ games, outcomes, stats }` with min, max, mean and median per measure. `src/game/sim.ts` has this game's `simSpec(mode, skill)`. A game stops after `maxSteps` (default 36,000 steps: 10 minutes) and counts as a `timeout`: an endless mode sets `maxSteps` in its `simSpec`. `npm run sim` prints a report (`npm run sim -- normal 2000 0.5` is mode, games, skill). `tests/game/sim.test.ts` asserts the tuning, for example that a decent player wins the daily, and that a normal game always ends:

```ts
const r = simulate(simSpec('daily', 0.8), seedRange(100));
expect(r.outcomes.won).toBeGreaterThanOrEqual(90);
```

### Browser hub suites

`tests/hub/_kit.ts` is the shared header. It loads the hub's own e2e kit from the hub checkout: `DG_HOST` if set, else `../diffenderfer-games` (`test/e2e/helpers.mjs`). One real test host starts per file with this game linked in. Each player is a browser context; console errors fail the test; screenshots are taken on failure. `DG_TEST_URL` points it at a running `npm run local` instead. Main exports: `env()`, `e2e(name, env, fn, opts)` (`opts.skip`: false or the reason; tests in `tests/kit-skips.json` skip on their own), `unlessDeclared(key, what)` (the skip reason when `game.<key>` is unset), `GAME_BLOCK`, `game` (hook wrappers: `screen`, `mode`, `paused`, `snap`, `newGame`, `solveNow`, `addScore`, `loseNow`, `autoplay`, `toTitle`, `pause`), `ready`, `waitScreen`, `openMenu`, `overlayLog`, `befriend`, `until`, `settle`, `today`, `L`, `SLUG`, `HUB`.

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

The kit's suites are `tests/hub/kit/`: `pause`, `progress` (saves, Continue, daily), `race`, `online`, `saved` (a day in progress from the title, credited to its day), `avatar` (the title bust, the designer, lobby faces), `turns` (online games the hub runs in two browsers: a link game, live moves, quick-chat, "Waiting for…", the hand-over, the end, Your games; skipped without `game.turns`), `world` (the hub serves the game's own room and a Tiled-made one; Adventure Mode opens it, friends-only typed bubbles, walk to a friend through its door; skipped without `game.world`), `planned` (all skipped: the canvas adapters, world tables), and `fake-parity` (FakeHub gives the same logs as the real hub). `env({ env: { HUB_LIMITS_JSON } })` shortens the hub's limits for a file (the turns suite hands over after 1.5 s); `env({ apps })` links more games. `api(player)` is that player's REST client (`get`, `post`, `put` under `/_api`); `today(-1)` is yesterday's daily day.

## Tests

- `tests/kit/testing/contract.test.ts`: the real `Hub` still fits `HubLike`.
- `tests/kit/testing/fake-hub.test.ts`: FakeHub fidelity.
- `tests/kit/testing/sim.test.ts`: the sim harness.
- `tests/hub/kit/fake-parity.test.ts`: fake against real, in a browser.

## Hub API used:

- Types only, from `@diffenderfer-games/hub` (`HubStatus`, `ResumeBlocker`, overlay and room types). The hub suites use the hub checkout's `test/e2e/helpers.mjs` and `test/helpers/client.mjs`.
