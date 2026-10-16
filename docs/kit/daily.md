# kit/daily

Source: `src/kit/daily/` (KIT: copy byte-identical; change it in the template first).

The adapter between the game and `hub.daily`: define the daily at boot, play the day the hub hands over, then complete it or leave it. It needs `game.dailyChallenges: true` in `package.json`. `defineGame` installs it when the game definition has a `daily` block, and the session calls `complete` and `leave` at the right moments. Puzzle games with a solver also use the separate daily-puzzle kit (not covered here).

## What the game does

Add a `daily` block with the extra fields to report. The game must build the same game from the same seed in `newRun`.

```ts
import type { DailyHooks } from '../kit/boot/index.ts';

export const daily: DailyHooks<Run> = {
  // extra fields for hub.daily.complete; `score` defaults to the result's first board
  meta: (run, outcome) => ({ coins: run.score, seconds: Math.round(run.t) }),
  offline: 'play-unrecorded', // or 'toast': only tell the player it needs a connection
};

// in the game definition
{ daily, newRun: (ctx, opts) => makeRun(opts.mode, opts.seed, opts.day) }
```

`newRun` gets `opts.mode === 'daily'`, `opts.seed` (the hub's seed) and `opts.day`. Use only `opts.rng` for randomness ([rng](rng.md)).

## What the kit does for you

- Calls `hub.daily.define` synchronously at boot, before any await. A day that starts before the game has mounted waits, then plays once (`ready()`).
- Sets the shared activity to `daily`, so the profile, the boards and Continue are not written ([core](core.md)).
- Calls `complete(meta)` only while a daily is active, and only once.
- Calls `leave()` on every way out that is not a win (quit, new game, title, a launch, a race). Without it `hub.resume.save` stays blocked for the whole page.
- Sends a `?daily=` deep link to the title if no day arrives within 8 s.
- Offline (`hub:daily-error`): the day can still be played, unrecorded, from `seedForDay(slug, day)`, so it is the same puzzle. The player is told once ("Today's challenge needs a connection. You can still play it for fun.").
- On `hub:daily-queued` tells the player it will count when they are back online.

## Rules it enforces

- Two calls to wire a daily, and the daily lasts until `complete()` or `cancel()`: [docs/hub.md Wiring a game](../hub.md#wiring-a-game-two-calls-plus-one-line-to-restore).
- A started day is a saved game: leaving pauses it, and it comes back where the player left it: [docs/hub.md Days in progress](../hub.md#days-in-progress-saved-games).
- The whole daily system: [docs/hub.md Daily challenges](../hub.md#daily-challenges).
- Daily results never reach the profile or normal boards: [docs/hub.md Daily challenges](../hub.md#daily-challenges) (the isolation guard is `Activity`).
- Offline completion is queued and replayed: [docs/hub.md Offline and replay](../hub.md#offline-and-replay).

## Options / API

| Name | What it is |
| --- | --- |
| `installDaily(hub, options)` | Registers the daily; returns a `DailyHandle` |
| `DailyOptions` | `slug`, `clock`, `events`, `onPlay`, `notify`, `onDeepLinkTimeout`, `offline?`, `search?`, `deepLinkMs?` (default 8000) |
| `DailyStart` | `day`, `seed`, `recorded`, `saved` (the state saved for that day, a day in progress; null when it starts fresh) |
| `DailyHandle#current` | The day being played (recorded or not), or null |
| `DailyHandle#ready()` | The game mounted: play a queued day now |
| `DailyHandle#complete(meta)` | Record the win once; false when nothing was active, or the day was unrecorded |
| `DailyHandle#leave()` | Pause it, unrecorded (`cancelDaily`): it stays in progress |
| `DailyHandle#discard()` | Give the day up (`hub.daily.discard`): its progress is dropped |

Days in progress (live since hub client next.6): the session saves a daily to the day (kit/resume → `hub.daily.save`) every 5 s, on pause and on the way out; `leave()` pauses it; `challenge.saved` brings it back (also from the title's `Daily challenge · Oct 14` row, kit/saved); a lost day is cleared, so it starts over from its seed.

## Tests

- `tests/kit/daily/daily.test.ts`
- `tests/hub-events/daily.test.ts` (rows 22 to 28 of the hub-event list)
- `tests/hub/kit/progress.test.ts` (the daily in a real browser), `tests/hub/kit/fake-parity.test.ts`

## Hub API used:

- `hub.daily.define`, `hub.daily.complete`, `hub.daily.cancel` (through `cancelDaily`), `hub.daily.active` (through `inDaily`), `hub.daily.discard`
- Window events: `hub:daily-error`, `hub:daily-queued`
