# kit/world

Source: `src/kit/world/` (KIT: copy byte-identical; change it in the template first).

The hub's world, and your game's room in it. The world is the hub's: a
walkable space of tile-map rooms where players' avatars walk, sit at tables
and take portals between rooms (hub.md [The world](../hub.md#the-world-gameworld)).
A game mostly declares data.

**Live since hub client 2.0.0-next.9:** the world itself (the hub serves it as
`/_hub/world.js` and draws players with the avatars' `walker` figure), a
game's own room (`game.world`: a map file or a generated one), the hub's
`dg-world` CLI and `hub-doctor`'s checks. **Coming:** game tables in the world
(W2: `launch.table`, Quick match) and in-game presence (W3: the People panel,
reactions, `setRoster`); their parts here stay off and their tests skipped.

## How the world relates to games

- Players reach a game from the hub's world (its rooms, the Hall's doors, a
  game's own room) the way they reach it from the catalog: an ordinary page
  load. A game needs no code for it, and never calls the world's socket ops.
- A game **may** have its own room, served as the world `game.<slug>`: a
  themed lounge for its players, with its name on it and portals to the
  hub's rooms. Without `game.world` the game simply has none.
- Avatars in the world are the hub's ones (kit/avatar); a game that draws a
  small full-body character can use the same look with `figure: 'walker'` on
  the avatar renderer and the Pixi crowd (hub.md "Avatars").
- Tables in your room that launch your game (W2) are coming; until then a
  room's tables are places to sit.

## What the game does

Declare the room in `package.json` (the template does):

```json
"game": {
  "world": {
    "generate": { "type": "lounge", "needs": { "tables": 4, "game": "Coin Dash" } }
  }
}
```

- `generate`: a hub world type (`lounge`, `park`, `station`, `camp`), a seed
  (default: the game's slug) and what that type needs (`tables`, `game`,
  `portals`, …). The same seed and needs always make the same room.
- `map`: a committed `dg-world@1` map file, `"map": "world/lobby.json"`
  (at most 256 KB; layers saved compressed). It wins when it is there and
  valid; `generate` is the fallback for a missing or broken file. Give
  either or both. Bump the map's `revision` when you change it.
- The hub never runs a game's script: make the map at build time and commit it.
- Its text (title, labels, game names) goes through the hub's content filter.

## Your room: the `dg-world` CLI

`@diffenderfer-games/world` (pinned exactly, next to the hub client) is the
hub's own map package: the generator, the validator and the Tiled converter.
Its CLI:

```sh
npx dg-world check world/lobby.json                 # every problem; exit 1 on errors
npx dg-world from-tiled world/lobby.tmj world/lobby.json
npx dg-world to-tiled world/lobby.json world/lobby.tmj
npx dg-world generate --type lounge --seed my-game --needs '{"tables":6}' --out world/lobby.json
```

The kit wraps it for this game's block (`scripts/kit/world.ts`):

| Script | What it does |
|---|---|
| `npm run world:check` | Checks the room the hub would serve: the map file (`dg-world check`), else the generated one |
| `npm run world:generate` | Writes the generated room to `game.world.map` (then commit it), or to `.tmp/world/` without one |
| `npm run world:tiled` | The map → `world/lobby.tmj`, to open and edit in [Tiled](https://www.mapeditor.org/) |
| `npm run world:build` | `world/lobby.tmj` from Tiled → the map (`from-tiled`), then checks it |

In Tiled: tile layers `ground`, `decor`, `walls`, `overhead`; object layers
`objects`, `regions` (spawns, portals, quiet zones) and `lights`; see the
package's README. `npx hub-doctor` checks a `game.world.map` file (it exists,
is valid, within the size limit) and warns about an unknown world type;
`npm run kit:check` checks the block's shape with the hub's own schema.

## What the kit does

- `kit/world/room.ts` (Node and tests): `parseGameWorld(block)` (the hub
  contract's `GameWorld` schema), `generateRequest` / `generateRoom(world,
  slug)` (the hub's way: the seed defaults to the slug), `roomProblems(text)`
  (the map file's errors) and `worldKey(slug)` (`game.<slug>`). The page never
  imports it: the hub draws the world.
- `scripts/kit/world.ts`: the four scripts above.
- Coming with W2, off now: `worldBlock(game)` derives default tables from the
  game block (one per mode, or Play, and Race for race games; titles cut to
  24 characters; `null` when there is nothing to declare); `quickMatch(hub)`
  returns a function only when `hub.mp.quickMatch` exists (the title shows
  Quick match only then); launches read `launch.table` (its options go to the
  game's `start`); `kit/online/roster.ts` has `rosterSync` for W3's
  `setRoster`. Their types are the shims in `kit/core/planned.ts`, and
  `game.world.tables` is not in the manifest (the strict schema refuses it).

## Which phase turns it on

In `src/kit/testing/phases.ts`:

- `world0` (shipped, next.9): the live world.
- `worldW4` (shipped, next.9): a game's own room, map files, `dg-world`, `hub-doctor`.
- `worldW2` (coming): game tables in the world, `launch.table`, Quick match.
- `worldW3` (coming): the People panel, reactions, `setRoster`.

## Rules enforced

- The hub never runs a game's code for its room: commit the map ([The world](../hub.md#the-world-gameworld)).
- Room text is player-facing: kid words, nothing violent; the hub filters it.
- A table launch (W2) will be an ordinary launch and follow the same contract: [The launch contract](../multiplayer.md#6-the-launch-contract).
- Show other players with the player card: [Showing other players](../multiplayer.md#11-showing-other-players--notification-etiquette).

## API

| Name | What it is |
|---|---|
| `parseGameWorld(block)` | `{ world, problems }`: the block (or `null`) by the hub's schema |
| `generateRequest(world, slug)`, `generateRoom(world, slug)` | the hub's generate request; the generated `WorldMap` (or `null`) |
| `roomProblems(text)` | a map file's errors, empty when the hub would take it |
| `worldKey(slug)` | `game.<slug>`, the world the hub serves it as |
| `TableDecl`, `WorldSource`, `worldBlock(game)` | W2 (coming): one table type; the default `{ tables }` block, or `null` |
| `quickMatch(hub)` | W2 (coming): `(mode?) => Promise<void>`, or `null` without the hub feature |
| `TableLaunch`, `KitLaunch` | in `kit/core/planned.ts`: `launch.table` as the kit reads it (W2) |

## Tests

Run now:

- `tests/kit/world/world.test.ts`: a block read the hub way (the seed is the
  slug, the key `game.<slug>`); this game's declared room generates a valid
  map, the same every time; a broken map file is reported; the W2 default
  tables and Quick match's feature check.
- `tests/scripts/kit-scripts.test.ts`: `checkWorld` takes a map file, a
  generate block or both, and refuses W2 tables.
- `tests/hub/kit/world.test.ts` (a real hub; skipped without `game.world`):
  the hub serves this game's room as a valid `dg-world@1` map the size
  `world:check` makes it, and the hub's own rooms; a room drawn in Tiled and
  converted with `dg-world from-tiled` is served from a game's map file.

Skipped until W2 or W3:

- `tests/hub-events/planned.test.ts` row 58 (`worldW2`): a table launch passes its options to `start`.
- Row 59 (`worldW2` + `savedGames3`): a join launch from a table opens an online game with no host step.
- Row 60 (`worldW3`): a reaction reaches the `onReaction` hook, and not when quiet.
- Row 61 (`worldW3`): `setRoster` is called once per roster change.
- Row 63 (`worldW2`): Quick match shows only when the hub has it, and routes like an invite.
- `tests/hub/kit/planned.test.ts` (`worldW2`): three players sit at a table and land in one room; a table opens an online game the hub runs.
- The `table-launch` shot.

## Hub API used

`game.world` (read by the hub), `@diffenderfer-games/world` and hub-contract's
`GameWorld` (scripts and tests), `GET /_api/world/maps/:key` (the hub suite).
Planned, behind feature checks: `hub.mp.quickMatch`, `hub.mp.setRoster`,
`launch.table`.
