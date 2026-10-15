# kit/world

Source: `src/kit/world/` (KIT: copy byte-identical; change it in the template first).

The game's tables in the hub's world, and Quick match. The world is the hub's. A game mostly declares data.

## What the game does

- Declares its tables in a `game.world` block (`key`, `title`, optional `mode`, `players`, `maxWaitSec`, `count`, `options`). If it declares none, the hub uses the defaults below.
- Reads `launch.table` when a launch came from a table. `kit/online` passes the table's options to the game's `start`, so a table "Quick (3 coins)" can set the target.
- Optionally ships a room file (`world/room.tmj`, converted to `world/room.json` in `dg-room@1`). Most games ship none; the hub makes a themed room.

```ts
import { worldBlock } from './kit/world/index.ts';

worldBlock({ multiplayer: { players: [2, 4] }, race: true });
// { tables: [ { key: 'play', title: 'Play', players: [2, 4] },
//             { key: 'race', title: 'Race', mode: 'race', players: [2, 2] } ] }
```

## What the hub does

World plan phases W2 to W4:

- W2: `game.world` tables, `launch.table` on host and guest launches, and `hub.mp.quickMatch({ mode })`.
- W3: the People panel, reactions (an `onReaction` hook), and `hub.mp.setRoster(userIds)` for own-server games.
- W4: `dg-room@1` room files and the converter (`dg-room from-tiled`, `dg-room check`).

## What the kit does

- `worldBlock(game)` derives the default `game.world` block: one table per mode (or one `Play` table), plus `Race` for race games (a duel of 2 to 2 unless `game.race.players` says more). Titles are cut to 24 characters. It returns `null` when there is nothing to declare.
- `quickMatch(hub)` returns a function when `hub.mp.quickMatch` exists, else `null`. The title shows a Quick match button (`data-testid="quick-match"`) only for online games where it is not `null`.
- `scripts/kit/world.ts` runs `npm run world:build` and `npm run world:check`. It looks for `dg-room` in `node_modules/.bin`. If the tool is not installed it says so and exits 0; if there is no `world/room.tmj` it says the hub makes a themed room.
- `kit/online/roster.ts` has `rosterSync`, which calls `setRoster` once per roster change.

## Which phase turns it on

- `worldW2`: tables, `launch.table`, Quick match.
- `worldW3`: People panel, reactions, `setRoster`.
- `worldW4`: room files and the converter.

All are `shipped: false` in `src/kit/testing/phases.ts`.

## What works today

- Quick match is hidden without `hub.mp.quickMatch`.
- `worldBlock` works now (pure). Launches with `launch.table` are read as ordinary host or guest launches.
- `game.world` is not in `package.json` yet. The pinned hub-contract manifest schema is strict and rejects the key until W2 ships, so `new-game` cannot write it now.
- `npm run world:build` and `world:check` are no-ops until `dg-room` arrives.

## Rules enforced

- A table launch is an ordinary launch and follows the same contract: [The launch contract](../multiplayer.md#6-the-launch-contract).
- Quick match routes like an invite, through the hub's rooms: [Hub rooms](../multiplayer.md#8-hub-rooms-no-server).
- Show other players with the player card: [Showing other players](../multiplayer.md#11-showing-other-players--notification-etiquette).

## API

| Name | What it is |
|---|---|
| `TableDecl` | one table type: `key`, `title`, `mode?`, `players: [min, max]`, `maxWaitSec?`, `count?`, `options?` |
| `WorldSource` | the parts of the game block the defaults come from |
| `worldBlock(game)` | the default `{ tables }` block, or `null` |
| `quickMatch(hub)` | `(mode?) => Promise<void>`, or `null` without the hub feature |
| `TableLaunch`, `KitLaunch` | in `kit/core/planned.ts`: `launch.table` as the kit reads it |

## Tests

`tests/kit/world/world.test.ts` runs now:

- the default tables from the game block;
- Quick match exists only when the hub has it.

Skipped:

- `tests/hub-events/planned.test.ts` row 58 (`worldW2`): a table launch passes its options to `start`.
- Row 59 (`worldW2` + `savedGames3`): a join launch from a table opens a turn game with no host step.
- Row 60 (`worldW3`): a reaction reaches the `onReaction` hook, and not when quiet.
- Row 61 (`worldW3`): `setRoster` is called once per roster change.
- Row 63 (`worldW2`): Quick match shows only when the hub has it, and routes like an invite.
- `tests/hub/kit/planned.test.ts` (`worldW2`): three players sit at a table and land in one room.

## Hub API used

`hub.mp.quickMatch`, `hub.mp.setRoster`, and `launch.table` from `hub.mp.onLaunch`. All behind feature checks.
