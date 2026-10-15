# kit/race

Source: `src/kit/race/` (KIT: copy byte-identical; change it in the template first).

`kit/race` is the `hub.race` adapter: a single-player game goes multiplayer by racing. Everyone gets the same game from the same seed, the hub shows a live race HUD, and the first to finish wins. The game writes no lobby, netcode or results screen. A game touches it through the `race` hooks in `src/game/race.ts` and a `game.race` block in `package.json`. `defineGame` does the rest.

## What the game does

Declare `game.race` in `package.json` (params, stats, `minMs`; see [docs/multiplayer.md §14.1](../multiplayer.md#141-declare-gamerace)) and export `RaceHooks`:

```ts
import type { RaceHooks } from '../kit/boot/index.ts';

export const race: RaceHooks<Run> = {
  // Live stats for the HUD: numbers, booleans or "#rrggbb"; never text; at most 12.
  stats: (run) => ({ coins: run.score }),
  // 0..1, how far along (the HUD bars).
  progress: (run) => (run.target > 0 ? run.score / run.target : 0),
  // Params for the Race button (hub.race.create). Default: the manifest defaults.
  params: () => ({ coins: RACE_DEFAULTS.coins }),
};
// hooks.ts: race, // and newRun builds the race game from opts.seed, opts.rng and opts.params only
```

`newRun(ctx, { mode: 'race', seed, rng, params })` must build the game from `seed` and `params` only. Use `opts.rng` for randomness.

## What the kit does for you

- Defines the race with the hub at boot, synchronously (`hub.race.define`); spectators get no `start`.
- Shows Race and Open races on the title when `game.race` is set; Race calls `hub.race.create({ params })` and a failure is toasted in kid words (`errText`).
- Starts the race session on the countdown (or after a reload, restoring the player's progress).
- Locks input until `startAt` and after the end (`locked()`); the session skips `step` while locked.
- Reports status after each step, throttled to one per 250 ms (`RACE_STATUS_MS`), and stashes the game in `sessionStorage` keyed by room and round, so a reload resumes it.
- Sends `finish` for a win or `lose` for a loss, once.
- Never pauses a race. The pause button asks "Leave race?"; yes leaves the race and returns to the title.
- Races write history only: no boards, no stats, no Continue.
- On the hub's `closed` event or Done, returns to the title.

## Rules it enforces

- Same seed, same puzzle; seeded and tick-based for real-time games: [docs/multiplayer.md §14.3](../multiplayer.md#143-fairness-same-seed-same-puzzle).
- Stats are numbers, booleans or `#rrggbb`, at most 12 (`bad_stats`): [docs/multiplayer.md §14.1](../multiplayer.md#141-declare-gamerace).
- Input locked until `startAt` and after `end`; `status` on every change, `finish` or `lose` once: [docs/multiplayer.md §14.2](../multiplayer.md#142-the-game-facing-api).
- Reports come from the browser, so races are for fun and write no boards: [docs/multiplayer.md §14.4](../multiplayer.md#144-trust).
- Room for the race HUD at the top and bottom: [docs/multiplayer.md §14.5](../multiplayer.md#145-testing).
- A race never pauses: [docs/multiplayer.md §4](../multiplayer.md#4-pausing-when-the-hub-opens-every-game).
- Race launches belong to the hub; the online adapter ignores them: [docs/multiplayer.md §6](../multiplayer.md#6-the-launch-contract).

A stat that breaks the stats rule is reported with `ruleBroken`: it throws in dev and tests and logs a warning in production (the stats are still sent).

## Options / API

| Export | What |
|---|---|
| `installRace(hub, options)` | Register with the hub and return a `RaceHandle` (`defineGame` calls it). |
| `RaceOptions` | `slug`, `clock`, `stash`, `onStart(race, restored)`, `onEnd`, `onExit`, `notify`, `isRun`. |
| `RaceHandle` | `live`, `current`, `locked()`, `report(run, stats, progress?)`, `finish(stats)`, `lose(stats)`, `leave()`, `create(params?)`, `browse()`, `history()`. |
| `checkStats(stats)` | Validate stats (numbers, booleans, `#rrggbb`, at most 12 keys). |
| `RACE_STATUS_MS` | 250: the status interval. |
| `raceBarTop(doc?)` | Height of the race HUD at the top in px. The same value is in `layout`'s `raceHud()`. |

Game side: `RaceHooks<R>` (`stats`, `progress?`, `params?`) in `kit/boot`.

## Tests

- `tests/kit/race/race.test.ts`: stats checks, input locked until the go and after the end with `finish` sent once, status throttling and the reload stash, a failed create told in kid words.
- `tests/hub-events/race.test.ts`: the hub's race events against the stub game (FakeHub).
- `tests/hub/kit/race.test.ts` (real hub, two players): create, Open races, join, same seed, live HUD, "Leave race?" on pause, finish, result, done. This covers [§14.5](../multiplayer.md#145-testing).

## Hub API used:

- `hub.race.define`, `hub.race.on('closed')`, `hub.race.status`, `finish`, `lose`, `leave`, `create`, `browse`, `openHistory`.
