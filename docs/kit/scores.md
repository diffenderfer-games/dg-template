# kit/scores

Source: `src/kit/scores/` (KIT: copy byte-identical; change it in the template first).

Leaderboards and stats, with the rules for which game modes may write where. `defineGame` calls `recordResult` when a game ends, using the `scores` spec and the `result` hook of the game definition. The game declares its boards and returns the numbers. It never calls `hub.submitScore` itself.

## What the game does

Declare each board in three places that must agree: `game.leaderboards` in `package.json`, the `BOARDS` constant, and the `scores` spec.

```ts
import type { ScoreSpec } from '../kit/scores/index.ts';

export const BOARDS = { high: { title: 'High score' } } as const; // src/game/config.ts

const scores: ScoreSpec = {
  boards: BOARDS,
  // dailyBoard: 'daily-score',    // a board that takes daily results (else dailies submit nothing)
  // onlineBoards: ['online-wins'], // boards that take online results
};

// in the game definition
{
  scores,
  result: (run, outcome) => ({ boards: { high: run.score }, incr: { played: 1 }, max: { bestScore: run.score } }),
}
```

## What the kit does for you

- Normal games submit to the boards and to stats.
- A daily submits nothing, unless the spec names a daily board.
- A race writes nothing: the hub keeps the race history.
- Online play records stats (each client its own) and submits only to the boards named in `onlineBoards`.
- Fire and forget: a hub error never reaches the game.
- Passes each board's title and sort order from the declaration to `hub.submitScore`.
- Using a board that is not declared breaks a rule: `ruleBroken` throws in dev and tests, and warns in production.

## Rules it enforces

- Declare boards up front, and keep `package.json` in step (`npm run kit:check` compares): [docs/hub.md Declaring boards up front](../hub.md#declaring-boards-up-front-recommended).
- Leaderboards in general: [docs/hub.md Leaderboards](../hub.md#leaderboards).
- Stats (`incrStat`, `maxStat`): [docs/hub.md Saves and stats](../hub.md#saves-and-stats).
- Races never write boards or stats; the hub keeps them: [docs/multiplayer.md §14.4](../multiplayer.md#144-trust).
- Dailies and the profile stay separate from normal progress: [docs/hub.md Daily challenges](../hub.md#daily-challenges).

## Options / API

| Name | What it is |
| --- | --- |
| `ScoreSpec` | `boards`, `dailyBoard?`, `onlineBoards?` |
| `BoardDecl` | `{ title, sort?: 'asc' \| 'desc' }` |
| `ResultNumbers` | `mode`, and optional `boards`, `incr`, `max` maps of numbers |
| `boardsFor(spec, mode)` | The set of boards a result in `mode` may reach |
| `recordResult(hub, spec, result)` | Submit by the rules; returns the boards submitted to |

Note: the game definition's own `ResultNumbers` (in `kit/boot`) is the same shape without `mode`. The session adds the mode.

## Tests

- `tests/kit/scores/scores.test.ts`
- `tests/hub-events/progress.test.ts` and `tests/hub-events/race.test.ts` exercise it through the booted game.

## Hub API used:

- `hub.submitScore(key, score, { title, sort? })`
- `hub.incrStat(key, n)`
- `hub.maxStat(key, n)`
