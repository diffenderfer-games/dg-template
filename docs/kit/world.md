# kit/world

Source: `src/kit/world/` (KIT: copy byte-identical; change it in the template first).

The hub's world, and your game's room in it. The world is the hub's: a
walkable space of tile-map rooms where players' avatars walk, sit at tables
and take portals between rooms (hub.md [The world](../hub.md#the-world-gameworld)).
A game mostly declares data.

**Live since hub client 2.0.0-next.9:** the world itself (the hub serves it as
`/_hub/world.js` and draws players with the avatars' `walker` figure), a
game's own room (`game.world`: a map file or a generated one), the hub's
`dg-world` CLI and `hub-doctor`'s checks. **Since next.10:** Adventure Mode,
the way players reach the world (`/world`), with walk to a friend and typed
bubbles between friends ([Adventure Mode](#adventure-mode-world)). **Since next.11:**
games play **in a box over the world** (`game.embed`, [below](#playing-over-the-world)),
the hub's rooms play the catalog's games by their labels ([Rooms and labels](#rooms-and-labels)),
and a game's own room has a door. **Coming:** online tables that seat several players
in one game (W2: `launch.table`, Quick match) and in-game presence (W3: the People panel,
reactions, `setRoster`); their parts here stay off and their tests skipped.

## How the world relates to games

- Players reach a game from the world's cabinets, tables and doors. It opens in the
  box over the world when it has `game.embed` and fits ([Playing over the world](#playing-over-the-world)),
  else as its page, an ordinary page load. A game never calls the world's socket
  ops (`world.*`, including `world.say` and `world.find`, are the hub's).
- A game **may** have its own room, served as the world `game.<slug>`: a
  themed lounge for its players, with its name on it, a door in from its
  family's room (or the Hall) and portals to the hub's rooms. Without
  `game.world` the game simply has none.
- Avatars in the world are the hub's ones (kit/avatar); a game that draws a
  small full-body character can use the same look with `figure: 'walker'` on
  the avatar renderer and the Pixi crowd (hub.md "Avatars").
- The tables in your room play your game (they carry its name: `needs.game`).
  Seating several players at one table into one online game is W2 (coming).

## Playing over the world

Walk up to a cabinet or a table and press E: the game opens in a box over the
world (an iframe of `/<slug>/?hub_embed=1`) when it declares `game.embed` and its
`size` fits the window at 70 % or more; otherwise (a phone, a small window) it
opens as its page. The template declares it (package.json):

```json
"embed": { "supported": true, "size": [960, 640] }
```

- `size`: the CSS px the game likes (`[w, h]`, or `{ "w", "h", "aspect" }` to keep its
  shape, letterboxed). 960×640 is a placeholder: set yours (`TODO(game)` in
  `src/game/config.ts`). `minScale` (default 0.7) is the smallest scale the box may use.
  `supported: false` (or no block) always opens the page.
- `frame`: an SVG drawn round the box ([A frame of your own](#a-frame-of-your-own));
  without it the hub draws its neon bezel.
- `npm run hub-doctor` checks the block and the frame.

**What the kit does in the box** (nothing for the game to write):

- **One menu:** the hub hides the game's own menu button and skips its intro; the
  world's menu is the menu. The kit marks the page `html[data-embed]` (`isEmbedded()`
  in kit/core) and drops the room it keeps for the button.
- **Esc:** the box closes on an Esc nobody handled. The kit's back (kit/input
  `installMenuNav`) calls `preventDefault()` only when it went somewhere: a modal
  closed, the pause screen back to play, the result or an online game back to the
  title, or play (the `pause` input reads Esc). **On the title Esc leaves the box.**
  Holding B on a gamepad (0.6 s) leaves too; a short B is the game's back.
- **Pause:** hub UI over the box pauses the game through `hub.overlay.autoPause`, like
  the menu on its page; an action game shows its pause card (kit/pause).
- **Layout:** every size is the window's (`innerWidth`/`innerHeight`, the box), never
  `screen`; the box resizing (fill the window, back) fires `ctx.onResize`.
- **Fullscreen:** `goFullscreen()` and `lockPointer()` (kit/layout) do nothing inside a
  frame (`inFrame()` in kit/core).

**The overlay checklist** (your own code):

- A `keydown` listener of yours that uses Esc calls `e.preventDefault()`, and only when
  it used it (a `back()` that returns whether it went anywhere). Never swallow Esc everywhere.
- An action game keeps the `pause` input and the kit's pause card.
- Lay out from `ctx.size()` / `ctx.onResize` (or the renderer's host element), never
  from `screen`, `outerWidth` or a fixed `100vh` layout; re-measure on resize.
- Fullscreen and pointer lock only through `goFullscreen` / `lockPointer`.
- No `top.location` or `window.top` (no frame-busting).
- Look at it: `npm run local`, then open `/world`, walk to a spot playing your game and
  press E (or `/<slug>/?hub_embed=1` in the box). `npm run test:hub -- tests/hub/kit/embed.test.ts`
  checks the rest.

## A frame of your own

`"frame": "embed/cabinet.svg"` draws your SVG round the box, in the hub's
"dg-frame" format (hub.md "The frame format"): one `<svg viewBox>`, exactly one
`<rect data-screen x y width height>` where the game goes (its shape the same as
`size`), vector art only (no scripts, images, links or outside references; SMIL
animation is fine). The host serves a sanitised copy and refuses a bad file (the
hub's bezel is drawn instead); `npm run hub-doctor` says why. Bubble Pop's arcade
cabinet (`embed/cabinet.svg` in its repo) is an example.

## Rooms and labels

The hub's rooms play the catalog's games, chosen by `game.labels` (the fixed list in
hub.md "Labels and the home page"; anything else is ignored):

- **Every room one of its genre labels fits:** cards in the card room, board in the
  board-game café (and the park's picnic tables), puzzle and typing in the puzzle
  garden, racing on the start lines, real-time-strategy in the war room, arcade,
  platformer and physics in the cabinets, sports and arcade at the station's holo-tables,
  word at the lounge's card tables. A game
  can be in several rooms.
- **The arcade is the catch-all:** a game with nowhere else gets one of its cabinets
  (at most 10, games that play over the world first).
- **Its family:** the first genre label in the list's order (cards, board, puzzle,
  arcade, platformer, real-time-strategy, physics, typing, word, sports, racing),
  whatever order you write them in. A game with `game.world` gets its room's door in
  that family's room (cards, board, arcade or the war room), else in the Hall.

The hub owns the table (`ROOM_SPOTS` in the hub); it may grow. Nothing for the
game to run: pick honest labels.

## What the game does

Declare the room in `package.json` (the template does):

```json
"game": {
  "world": {
    "generate": { "type": "lounge", "needs": { "tables": 4, "game": "My Game" } }
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

## Adventure Mode (`/world`)

Adventure Mode (hub client next.10) is the world as players reach it: the
glowing **Adventure Mode** card at the top of the home page and the hub
menu opens `/world` (dg-host serves it; `/_hub/adventure.js` starts it).
`/world` alone goes back to the player's last world (the Hall the first
time); `/world/<place>` deep-links. Guests can come in. The hub menu works
inside (the world's input pauses under it), and **To All Games** (once Library
Mode) goes back to the games. Your game's code runs only in the box
([Playing over the world](#playing-over-the-world)).

**How your room appears in it:**

- It is the place `game.<slug>`: `/world/game.<slug>` opens straight into
  it (`roomPath(slug)` in kit/world, for a link from your docs, What's new
  or your own UI; an ordinary link, the hub does the rest).
- **The way in:** a door with your cover on its name plate, in your family's
  room (the card room, the board-game café, the arcade or the war room; the Hall
  for the others: [Rooms and labels](#rooms-and-labels)), and the link.
- Its way out leads back to that door, unless `needs.portals` names the hub's
  rooms it opens on.
- Your room's title, labels and game names show in it, through the content
  filter. A full room overflows into a second instance like any other.
- Don't name a game `world`: a game that owns the slug takes `/world` from
  Adventure Mode.

**Walk to a friend:** the Friends panel lists the friends in the world and
where (only friends who show their presence; never across a block). "Walk
to" asks the hub for the fewest-doors route (`planWorldRoute` in
`@diffenderfer-games/world`) and walks it, door by door, to a cell beside
them, following them if they move. From your room it goes out through your
room's door; into your room only if a door leads there, else the player is
told "There's no door from here to …". Nothing for a game to do, except keep
the room's doors reachable (`npm run world:check` checks it).

**Say something (`world.say`):** a bubble over the player's head for a few
seconds. **Quick-chat** phrases and emotes reach everyone who can see them
(emotes only in quiet zones; nothing when chat is off). **Typed text** only
when the player's chat allows it (not a guest, no parent lock, a friend to
type to), moderated like all chat, and delivered **only to their mutual
friends who can see them**; strangers never receive it (multiplayer.md:
free text only between mutual friends). The phrases are the hub's own: a
game's `game.turns.quickChat` / `game.multiplayer.quickChat` phrases are
for its own rooms and online games, not the world.

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
  slug)` (the hub's way: the seed defaults to the slug) and `roomProblems(text)`
  (the map file's errors). The page never imports it: the hub draws the world.
- `kit/world/index.ts` (page-safe): `worldKey(slug)` (`game.<slug>`) and
  `roomPath(slug)` (`/world/game.<slug>`, Adventure Mode in your room);
  room.ts re-exports both.
- `scripts/kit/world.ts`: the four scripts above.
- The box over the world (the other modules' parts): Esc and back in kit/input
  (`installMenuNav`, `ControlsHandle.usesKey`), the pause card in kit/pause and
  kit/boot, `inFrame()` / `isEmbedded()` in kit/core, `goFullscreen()` /
  `lockPointer()` in kit/layout, `html[data-embed]` in kit/ui's CSS.
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
- `adventure` (shipped, next.10): Adventure Mode, walk to a friend, typed bubbles for friends.
- `worldW4` (shipped, next.9): a game's own room, map files, `dg-world`, `hub-doctor`.
- `worldW2` (coming): game tables in the world, `launch.table`, Quick match.
- `worldW3` (coming): the People panel, reactions, `setRoster`.

## Rules enforced

- The hub never runs a game's code for its room: commit the map ([The world](../hub.md#the-world-gameworld)).
- Free text in the world only between mutual friends; everyone else gets quick chat. The hub enforces it; a game never sends world chat.
- Room text is player-facing: kid words, nothing violent; the hub filters it.
- A table launch (W2) will be an ordinary launch and follow the same contract: [The launch contract](../multiplayer.md#6-the-launch-contract).
- Show other players with the player card: [Showing other players](../multiplayer.md#11-showing-other-players--notification-etiquette).

## API

| Name | What it is |
|---|---|
| `parseGameWorld(block)` | `{ world, problems }`: the block (or `null`) by the hub's schema |
| `generateRequest(world, slug)`, `generateRoom(world, slug)` | the hub's generate request; the generated `WorldMap` (or `null`) |
| `roomProblems(text)` | a map file's errors, empty when the hub would take it |
| `worldKey(slug)` | `game.<slug>`, the world the hub serves it as (kit/world; room.ts re-exports it) |
| `roomPath(slug)` | `/world/game.<slug>`: Adventure Mode, opened in this game's room |
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
  converted with `dg-world from-tiled` is served from a game's map file;
  Adventure Mode at `roomPath(slug)` opens this game's room, a typed bubble
  reaches a friend there and never a stranger, quick chat reaches the
  stranger, and "Walk to" takes a player out through the room's door to a
  friend in the Hall.
- `tests/hub/kit/embed.test.ts` (a real hub; skipped without `game.embed.supported`):
  the world's play API opens this game in its box (`?hub_embed=1`, so the size fits a
  desktop window at 70 %); its own menu button is hidden and the page is
  `html[data-embed]`; Esc on the title closes the box; Esc in play pauses and the box
  stays, Esc on the pause card goes back to play; the world's menu over the box pauses it.
- `tests/hub-events/input.test.ts`: Esc is handled (preventDefault) only when it goes
  back or play reads it; never on the title, a locked modal or under hub UI.
- `tests/kit/core/env.test.ts`: `inFrame`, `isEmbedded`, and no fullscreen or pointer
  lock inside a frame.

Skipped until W2 or W3:

- `tests/hub-events/planned.test.ts` row 58 (`worldW2`): a table launch passes its options to `start`.
- Row 59 (`worldW2` + `savedGames3`): a join launch from a table opens an online game with no host step.
- Row 60 (`worldW3`): a reaction reaches the `onReaction` hook, and not when quiet.
- Row 61 (`worldW3`): `setRoster` is called once per roster change.
- Row 63 (`worldW2`): Quick match shows only when the hub has it, and routes like an invite.
- `tests/hub/kit/planned.test.ts` (`worldW2`): three players sit at a table and land in one room; a table opens an online game the hub runs.
- The `table-launch` shot.

## Hub API used

`game.world`, `game.embed` and `game.labels` (read by the hub), `@diffenderfer-games/world`
and hub-contract's `GameWorld` (scripts and tests), `GET /_api/world/maps/:key` and
Adventure Mode's play API (`window.__ADVENTURE__.adventure.play`, the hub suites).
Planned, behind feature checks: `hub.mp.quickMatch`, `hub.mp.setRoster`,
`launch.table`.
