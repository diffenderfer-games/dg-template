# Kit changelog

KIT doc. One entry per kit version; per module inside. A **major** version
means a hook's signature changed: the entry says how to move a game over.
`npm run kit:sync` prints the entries newer than a game's `kit.json`.

## 1.2 (2026-10-16)

The hub client is pinned at **2.0.0-next.9** (what diffenderfer.games runs),
with `@diffenderfer-games/world` 2.0.0-next.9 next to it. Online games over
days get the kit's own screen on next.8's online games on the server; the
world and a game's own room (next.9) are on; game tables in the world (W2)
and in-game presence (W3) stay off (coming).

- **turns** 1.2: the rules types and RNG come from the zod-free
  `@diffenderfer-games/hub/turns-rules` (`kit/turns/rules.ts`, what a rules
  module imports; `checkTurnRules` stays in the index for tests). The kit's
  screen for online games over days (`kit/turns/screen.ts`,
  `kit/turns/status.ts`): the status line ("Your turn"; "Ann is playing", or
  "Waiting for Ann…" only when her seat's `connected` is `false`), seats with
  faces, Start, Copy the link, Remind them, **Let the computer play for Ann**
  (only while `canLetComputerPlay()`; asked again on every `turn` event and
  when `handOverAt` comes, no polling), Rematch, Leave, Back, and chat with
  the game's own `game.turns.quickChat` phrases. A move out of turn
  (`mayActNow`) is offered as `board.canMove`.
- **boot** 1.2: a definition's `turns` hook (`draw(ctx, el, board)`,
  `create`) with `game.turns` declared turns it on: the title's Play over
  days (the computer, a link, anyone), Your games and the title's Continue
  rows open online games on the kit's screen (`openTurns`), an invite link
  (`?hub_turn_link=`) takes the seat at boot (`TurnsFlow`,
  `kit/boot/turns-flow.ts`). Without it nothing changes.
- **core** 1.2: `TurnGameLike` adds `outcome`, `chat`, `chatMode`, `link`,
  `mayActNow`, `start`, `say`, `canLetComputerPlay`, `letComputerPlay`,
  `rematch`; `kit/core/manifest.ts` reads `game.turns` and the quick-chat
  phrases from package.json at build time; new strings for the screen
  (`isPlaying`, `letComputerPlay`, `turns*`, `yourTurn`, `back`).
- **online** 1.1: one chat panel for rooms and online games (`ChatPort`,
  `roomChat`, `gamePhrases`); rooms offer the game's own
  `game.multiplayer.quickChat` phrases after the hub's.
- **ui** 1.1: the turns screen's styles; the due seat outlined.
- **world** 1.2: a game's own room is live: `game.world` (`map` and/or
  `generate`), `kit/world/room.ts` (`parseGameWorld`, `generateRoom`,
  `roomProblems`, `worldKey`) with the hub's schema and
  `@diffenderfer-games/world`. `npm run world:check`, `world:generate`,
  `world:tiled`, `world:build` run the hub's `dg-world` CLI (the `dg-room`
  plan is gone). Tables, Quick match and `setRoster` stay off (W2/W3).
- **testing** 1.2: `FakeTurnGame` has the new members, `seatConnected`,
  `chatFrom` and the client's `canLetComputerPlay` rule; `HUB_PHASES` adds
  `world0` and flips `worldW4` (shipped); W2 and W3 say "coming".
- **hub-events, hub-suites** 1.2: `tests/hub-events/turns.test.ts`; new
  suites `tests/hub/kit/turns.test.ts` (two browsers: a link game, live moves,
  quick-chat, "Waiting for…", the hand-over, the end, Your games) and
  `world.test.ts` (the hub serves the game's room and a Tiled-made one);
  `planned` keeps only world tables and the canvas adapters.
- **scripts** 1.2: `build:rules` skips a game without rules (`npm run build`
  runs it after vite); `new-game --no-turns` (also drops `game.turns` and
  the template's `turns` shot) and `--no-world`, and `--title` names the
  generated room; `checkWorld` uses the hub's `GameWorld` schema.
- **server** 1.2 (docs): `game.data` passes `hub-doctor` since next.8; the
  next.7 gap note is gone. A test checks the contract accepts it.
- **test-hook** 1.1 (docs): the `turns` screen.
- **docs, saved, avatar** 1.2: README, testing (the `checkTurnRules` options,
  `revealed` and `shuffleHidden` among them), the walker figure, Your games.

### Moving a game over

1. `npm install --save-exact @diffenderfer-games/hub@2.0.0-next.9` and
   `npm install --save-exact --save-dev @diffenderfer-games/world@2.0.0-next.9`,
   then `npm run kit:sync`.
2. Online rules: import the types from `../../kit/turns/rules.ts`. In
   package.json set `"build": "vite build && node scripts/kit/build-rules.ts"`
   (and `game.build` back to `npm run build`).
3. To use the kit's screen for online games over days: add a `turns` hook
   (copy the template's `src/game/turns/board.ts`) to the definition. A game
   with its own screen keeps it and gives no hook. Drop any refresh timer of
   your own: the client catches up by itself.
4. `game.world`: replace any `tables` block with `map` and/or `generate`
   (docs/kit/world.md); the `dg-room` scripts are now `world:*`.
5. An own-server game that kept `game.data` out of package.json: add it now.
6. Tests that called `chatPanel(room, …)` pass `roomChat(room)`.

## 1.1 (2026-10-15)

The hub client is pinned at **2.0.0-next.7** (what diffenderfer.games runs).
Saved games, online games over days and avatars are live and switched on;
the world stays off (coming in next.9).

- **core** 1.1: `HubLike` takes `hub.saved`, `hub.turns`, `hub.avatar` and
  `hub.userId()` from the client's own types (required, no shims);
  `DailyLike` has `save`, `resume`, `discard`, `inProgress`;
  `planned.ts` keeps only the world. New window events
  `hub:daily-resumed`, `hub:daily-paused`, `hub:daily-discarded`.
- **saved** 1.1: the title's Continue rows come from `hub.saved` (the line
  under Continue is the progress label alone, not "Continue: …" again) (the saved
  game and days in progress, in the hub's wording); `onOpen` takes only the
  kinds the game can open; `discard`, `dailiesInProgress`. `available` is gone.
- **daily, resume, boot** 1.1: a day the player leaves is paused (it stays in
  progress, saved to the day) and comes back with `challenge.saved`; a lost
  day starts over from its seed; a normal game is never saved into a day the
  hub just started; a title still loading never covers a game that started,
  and Your games `change` redraws the title only when its rows changed;
  an opened day plays after the router has mounted it.
- **avatar** 1.1: `avatarRenderer(hub)` loads the hub's renderer
  (`hub.avatar.load()` + `defineAvatarElement()`) before any face draws (the
  title demo drew nothing before); `showFeel` plays the feeling on the
  element's animator (the `feel` attribute did nothing); lobby faces use the
  seat's `look`; the title bust follows your own `change` by
  `hub.userId()`, says "Edit avatar" and sits under the title's buttons
  (a fixed corner covered them on a phone); no initial-letter fallback.
  The starters' `avatar-pixi.ts` / `avatar-three.ts` use the hub's typed adapters.
- **turns** 1.1: the rules contract and `checkTurnRules` are the hub's own
  (`@diffenderfer-games/hub/turns`, re-exported); the adapter is plain
  `hub.turns`. Coming in next.8: the `turns-rules` entry, presence,
  `mayAct`, buzz.
- **testing** 1.1: `FakeHub` always has `saved`, `turns`, `avatar` and
  `userId()` (`planned` takes only `world`); `FakeDaily` keeps days in
  progress (`inProgressDay`); `FakeResume` saves to the day during a daily;
  `HUB_PHASES` marks saved games and avatars shipped.
- **hub-events, hub-suites** 1.1: rows 28, 56, 57 and 62 run; new suites
  `tests/hub/kit/saved.test.ts` and `avatar.test.ts`; `_kit.ts` adds `api(p)`
  and `today(offset)`.
- **scripts** 1.1: the `avatar`, `avatar-designer` and `your-games` shots run.
- **docs, layout, server, world** 1.1 (docs only): the hub menu button's 64px
  corner and `setInsets({ top })` ([layout.md](layout.md#the-hub-menu-button));
  `game.data` for own-server games ([server.md](server.md#backups-gamedata),
  with the next.7 `hub-doctor` gap); the world marked "coming in next.9".

### Moving a game over

1. `npm install --save-exact @diffenderfer-games/hub@2.0.0-next.7`, then `npm run kit:sync`.
2. Online rules (`src/game/turns/rules.ts`): the RNG is the hub's `TurnRng`
   (`rng.int(6)`, not `Math.floor(rng() * 6)`); add `export default rules`.
   `checkTurnRules` throws instead of returning problems: `checkTurnRules(rules, { seats: [2, 3] })`.
3. Tests that built a FakeHub with `planned: { savedGames, turns, avatars }`:
   drop those flags (the APIs are always there). `fake.daily.savedFor.set(day, { saved })`
   is now `fake.daily.inProgressDay(day, saved)`.
4. Code that checked `hub.saved`, `hub.avatar` or `createTurns(hub).available`: they are always there.

## 1.0 (2026-10-15)

The first kit. Every module at 1.0:

- **core, rng, testing**: JSON types, the activity model, strings, the seeded
  RNG, FakeHub and the fakes, the planned-phase list, the balance sim.
- **save, resume, daily, pause, scores, test-hook**: the profile, Continue,
  the daily challenge, pause on hub UI, boards and stats, `window.__game`.
- **boot, input, layout, loop, ui, settings-ui**: `defineGame`, the router and
  screens, controls, the safe region, the fixed-step loop, screens, modals,
  toasts, the settings sheet.
- **race, online, audio, haptics, server**: races, hub rooms (lobby, match,
  chat, reconnect, computer players for away seats), music in a worker,
  vibration, the own-server helper.
- **saved, turns, avatar, world**: written against the planned hub APIs;
  feature-checked, tests skipped until the hub phase ships.
- **hub-events, hub-suites**: a unit test per hub event; browser suites on a
  real hub (pause, saves, daily, race, online, FakeHub parity).
- **scripts**: `check`, `kit:sync/check/hash`, `new-game`, `todo`, `shots`,
  `shots:hub`, `shots:sheet`, `cover`, `local`, `probe`, `ui:check`,
  `clean:procs`, `build:rules`, `world:build/check`, `sync-docs`,
  `sync-hub-server`.
- **ci**: the deploy is gated on `npm run check` and the hub suites.
